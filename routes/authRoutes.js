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
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'], // Must match scope in googleStrategy.js
    session: false // No session for API
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
  passport.authenticate('google', { session: false, failureRedirect: '/auth/login-failure' }, (err, data, info) => {
    if (err) {
      console.error('Google OAuth callback error:', err);
      return res.status(500).json({ message: 'Authentication failed during Google callback.', error: err.message });
    }
    if (!data || !data.token) {
      // This case might happen if 'done' was called with (null, false) or without a token
      const message = (info && info.message) ? info.message : 'Authentication failed. No token received from Google strategy.';
      console.warn('Google OAuth callback - no token:', info);
      return res.status(401).json({ message });
    }
    // data = { user, token } from googleStrategy
    res.json({
      message: 'Google authentication successful!',
      token: data.token,
      user: data.user // Optionally return user details
    });
  })(req, res, next);
});

/**
 * @route GET /auth/facebook
 * @description Initiates Facebook OAuth 2.0 authentication flow.
 * Redirects the user to Facebook's consent screen.
 * @access Public
 */
router.get('/facebook',
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile'], // Adjust scope as needed, ensure it matches facebookStrategy.js
    session: false // No session for API
  })
);

/**
 * @route GET /auth/facebook/callback
 * @description Handles the callback from Facebook after authentication.
 * Responds with a JWT.
 * @access Public
 */
router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', { session: false, failureRedirect: '/auth/login-failure' }, (err, data, info) => {
    if (err) {
      console.error('Facebook OAuth callback error:', err);
      return res.status(500).json({ message: 'Authentication failed during Facebook callback.', error: err.message });
    }
    if (!data || !data.token) {
      const message = (info && info.message) ? info.message : 'Authentication failed. No token received from Facebook strategy.';
      console.warn('Facebook OAuth callback - no token:', info);
      return res.status(401).json({ message });
    }
    // data = { user, token } from facebookStrategy
    res.json({
      message: 'Facebook authentication successful!',
      token: data.token,
      user: data.user // Optionally return user details
    });
  })(req, res, next);
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
