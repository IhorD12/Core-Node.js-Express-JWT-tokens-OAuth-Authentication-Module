// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

/**
 * @fileoverview Authentication routes for Google and Facebook OAuth.
 */

/**
 * @route GET /auth/google
 * @description Initiates Google OAuth 2.0 authentication flow.
 * Redirects the user to Google's consent screen.
 * @access Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'], // Must match scope in googleStrategy.js
    session: false, // No session for API
  })
);

/**
 * @route GET /auth/google/callback
 * @description Handles the callback from Google after authentication.
 * If authentication is successful, it receives user and token from the Google strategy.
 * Responds with a JWT.
 * If authentication fails, it redirects to a (conceptual) login failure page or returns an error.
 * @access Public
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate(
    'google',
    { session: false, failureRedirect: '/auth/login-failure' },
    (err, data, info) => {
      if (err) {
        console.error('Google OAuth callback error:', err);
        return res
          .status(500)
          .json({ message: 'Authentication failed during Google callback.', error: err.message });
      }
      if (!data || !data.accessToken) { // Check for accessToken
        // This case might happen if 'done' was called with (null, false) or without a token
        const message =
          info && info.message
            ? info.message
            : 'Authentication failed. No access token received from Google strategy.';
        console.warn('Google OAuth callback - no access token:', info);
        return res.status(401).json({ message });
      }
      // data = { user, accessToken, refreshToken } from googleStrategy
      res.json({
        message: 'Google authentication successful!',
        accessToken: data.accessToken, // Send accessToken
        refreshToken: data.refreshToken, // Send refreshToken
        user: data.user, // Optionally return user details
      });
    }
  )(req, res, next);
});

/**
 * @route GET /auth/facebook
 * @description Initiates Facebook OAuth 2.0 authentication flow.
 * Redirects the user to Facebook's consent screen.
 * @access Public
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile'], // Adjust scope as needed, ensure it matches facebookStrategy.js
    session: false, // No session for API
  })
);

/**
 * @route GET /auth/facebook/callback
 * @description Handles the callback from Facebook after authentication.
 * Responds with a JWT.
 * @access Public
 */
router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate(
    'facebook',
    { session: false, failureRedirect: '/auth/login-failure' },
    (err, data, info) => {
      if (err) {
        console.error('Facebook OAuth callback error:', err);
        return res
          .status(500)
          .json({ message: 'Authentication failed during Facebook callback.', error: err.message });
      }
      if (!data || !data.accessToken) { // Check for accessToken
        const message =
          info && info.message
            ? info.message
            : 'Authentication failed. No access token received from Facebook strategy.';
        console.warn('Facebook OAuth callback - no access token:', info);
        return res.status(401).json({ message });
      }
      // data = { user, accessToken, refreshToken } from facebookStrategy
      res.json({
        message: 'Facebook authentication successful!',
        accessToken: data.accessToken, // Send accessToken
        refreshToken: data.refreshToken, // Send refreshToken
        user: data.user, // Optionally return user details
      });
    }
  )(req, res, next);
});

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

const jwt = require('jsonwebtoken');
const { jwtSecret, refreshTokenExpirationSeconds, nodeEnv: currentEnv } = require('../../config'); // Assuming root config
const { findUserById, isRefreshTokenValid, removeRefreshToken, addRefreshTokenToUser } = require('../auth/mockUserStore');
const { generateAccessToken, generateRefreshToken } = require('../auth/tokenUtils'); // Get individual token generators


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
    // 1. Verify the refresh token's signature and structure
    const decoded = jwt.verify(providedRefreshToken, jwtSecret, { ignoreExpiration: false }); // Let it throw on expired

    // 2. Check type claim
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid token type. Expected refresh token.' });
    }

    // 3. Validate against store: Check if this refresh token is active for the user
    const userId = decoded.sub;
    const isValidInStore = await isRefreshTokenValid(userId, providedRefreshToken);

    if (!isValidInStore) {
      // This could mean the token was already used (if rolling) or revoked.
      return res.status(401).json({ message: 'Refresh token not recognized or has been invalidated.' });
    }

    // 4. (Security Enhancement - Rolling Refresh Tokens) Invalidate the used refresh token
    await removeRefreshToken(userId, providedRefreshToken);

    // 5. Issue a new access token
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found for refresh token.' });
    }
    // Use ACCESS_TOKEN_EXPIRATION_SECONDS from tokenUtils.js logic
    const accessTokenExpiration = (currentEnv === 'test' ? 5 * 60 : 15 * 60);
    const newAccessToken = generateAccessToken(user, jwtSecret, accessTokenExpiration);

    // 6. Issue a new refresh token
    const newRefreshToken = generateRefreshToken(user, jwtSecret, refreshTokenExpirationSeconds);
    await addRefreshTokenToUser(userId, newRefreshToken);

    res.json({
      message: 'Tokens refreshed successfully.',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }
    console.error('Error during token refresh:', error);
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
    // 1. Verify token structure and signature. Expiry can be ignored for logout,
    // as we want to invalidate it even if it's already expired (to clean up store).
    // However, to get the 'sub' (userId) reliably, it must be a valid JWT.
    // If it's structurally invalid, we can't trust its 'sub' claim.
    const decoded = jwt.verify(providedRefreshToken, jwtSecret, { ignoreExpiration: true }); // Ignore expiration for logout's purpose of finding user ID

    // 2. Check type claim
    if (decoded.type !== 'refresh') {
      // We could choose to ignore this if any "our" token should be removable,
      // but for strictness on /logout for refresh tokens:
      return res.status(401).json({ message: 'Invalid token type. Expected refresh token for logout.' });
    }

    const userId = decoded.sub;

    // 3. Attempt to remove the refresh token from the store.
    // isRefreshTokenValid check is implicitly handled by removeRefreshToken:
    // if it's not there, removeRefreshToken will return false.
    const removed = await removeRefreshToken(userId, providedRefreshToken);

    if (removed) {
      res.status(200).json({ message: 'Logout successful. Refresh token invalidated.' });
    } else {
      // This could mean the token was already invalidated, expired and cleaned up, or never existed.
      // For logout, it's fine to just say it's done or effectively done.
      res.status(200).json({ message: 'Logout successful or token already invalidated.' });
    }

  } catch (error) {
    // If token is malformed or signature is invalid, we can't trust its claims.
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token format.' });
    }
    // For other errors (e.g., unexpected issues)
    console.error('Error during logout:', error);
    return res.status(500).json({ message: 'Could not process logout.' });
  }
});
