// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const router = express.Router();
const { oauthProviders } = require('../../config'); // Import configured providers
const logger = require('../../config/logger'); // Import logger

/**
 * @fileoverview Dynamically generates OAuth authentication routes.
 * Also includes fixed routes for token refresh, logout, and login failure.
 */

// Dynamically create OAuth initiation and callback routes
if (oauthProviders && Array.isArray(oauthProviders)) {
  oauthProviders.forEach(provider => {
    if (!provider.name || !provider.authPath || !provider.callbackPath || !provider.options) {
      logger.warn(`Skipping invalid OAuth provider configuration: ${JSON.stringify(provider)}`);
      return;
    }

    logger.info(`Creating OAuth routes for provider: ${provider.name}`);

    /**
     * @route GET /auth/:providerName
     * @description Initiates OAuth 2.0 authentication flow for the specified provider.
     * Redirects the user to the provider's consent screen.
     * @access Public
     */
    router.get(
      `/${provider.name}`, // Use just provider.name for relative path from /auth
      passport.authenticate(provider.name, {
        scope: provider.options.scope,
        session: false,
        ...(provider.options.customParams || {}) // For any extra params if needed by strategy
      })
    );

    /**
     * @route GET /auth/:providerName/callback
     * @description Handles the callback from the OAuth provider after authentication.
     * Responds with JWTs (access and refresh) and user information.
     * @access Public
     */
    router.get(
      `/${provider.name}/callback`, // Use just provider.name for relative path from /auth
      (req, res, next) => {
        passport.authenticate(
          provider.name,
          { session: false, failureRedirect: '/auth/login-failure' }, // failureRedirect assumes /auth prefix
          (err, data, info) => { // data here is { user, accessToken, refreshToken } from strategy
            if (err) {
              logger.error(`${provider.name} OAuth callback error:`, { provider: provider.name, error: err.message, stack: err.stack });
              return res.status(500).json({
                message: `Authentication failed during ${provider.name} callback.`,
                error: err.message,
              });
            }
            if (!data || !data.accessToken) {
              const message = (info && info.message)
                ? info.message
                : `Authentication failed. No access token received from ${provider.name} strategy.`;
              logger.warn(`${provider.name} OAuth callback - no access token:`, { provider: provider.name, info });
              return res.status(401).json({ message });
            }
            res.json({
              message: `${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} authentication successful!`,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: data.user,
            });
          }
        )(req, res, next);
      }
    );
  });
}


/**
 * @route GET /auth/login-failure
 * @description A conceptual route for handling OAuth login failures.
 * In a real app, this might redirect to a frontend page. Here, it returns JSON.
 * @access Public
 */
router.get('/login-failure', (req, res) => {
  // req.flash is not available as we are not using sessions or express-flash
  // We rely on query parameters or specific error handling in callbacks if more detail is needed.
  res.status(401).json({ message: 'OAuth authentication failed. Please try again.' });
});

module.exports = router;

const authService = require('../services/authService');
// const jwt = require('jsonwebtoken'); // No longer directly used here
// const { jwtSecret, refreshTokenExpirationSeconds, nodeEnv: currentEnv } = require('../../config'); // Used by authService
// const { findUserById, isRefreshTokenValid, removeRefreshToken, addRefreshTokenToUser } = require('../auth/mockUserStore'); // Used by authService/userService
// const { generateAccessToken, generateRefreshToken } = require('../auth/tokenUtils'); // Moved to authService


// ... (existing GET routes for /google, /facebook, /login-failure) ...

/**
 * @route POST /auth/refresh
 * @description Renews an access token using a valid refresh token.
 * Implements rolling refresh tokens: a new refresh token is issued and the old one invalidated.
 * @access Public
 * @body { "refreshToken": "string" }
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken: providedRefreshToken } = req.body;

  if (!providedRefreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    const { accessToken, refreshToken } = await authService.refreshAuthTokens(providedRefreshToken);
    res.json({
      message: 'Tokens refreshed successfully.',
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    // authService will throw errors with status if applicable, or generic errors
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'TokenExpiredError') { // Still catch JWT specific errors if authService doesn't abstract them
      return res.status(401).json({ message: 'Refresh token expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }
    logger.error('Error during token refresh:', { message: error.message, stack: error.stack });
    return res.status(500).json({ message: 'Could not refresh token.' });
  }
});

/**
 * @route POST /auth/logout
 * @description Invalidates a refresh token.
 * The client is responsible for discarding the access token.
 * @access Public
 * @body { "refreshToken": "string" }
 */
router.post('/logout', async (req, res) => {
  const { refreshToken: providedRefreshToken } = req.body;

  if (!providedRefreshToken) {
    return res.status(400).json({ message: 'Refresh token is required to logout.' });
  }

  try {
    const removed = await authService.logoutUser(providedRefreshToken);
    if (removed) {
      res.status(200).json({ message: 'Logout successful. Refresh token invalidated.' });
    } else {
      // If authService.logoutUser returns false, it means token was not found/removed (already invalid)
      res.status(200).json({ message: 'Logout successful or token already invalidated.' });
    }
  } catch (error) {
    // authService will throw errors with status if applicable
    if (error.status) {
        return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'JsonWebTokenError') { // Still catch JWT specific errors
      return res.status(401).json({ message: 'Invalid refresh token format.' });
    }
    logger.error('Error during logout:', { message: error.message, stack: error.stack });
    return res.status(500).json({ message: 'Could not process logout.' });
  }
});
