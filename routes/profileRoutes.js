// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @fileoverview Routes for user profile, protected by JWT authentication.
 */

/**
 * @route GET /auth/profile
 * @description Retrieves the profile of the authenticated user.
 * Requires a valid JWT in the Authorization header (Bearer token).
 * @access Private
 * @middleware verifyToken - Ensures the user is authenticated.
 */
router.get('/profile', verifyToken, (req, res) => {
  // If verifyToken middleware succeeds, req.user will be populated
  // with the user object from the JWT payload (via jwtStrategy).
  if (!req.user) {
    // This case should ideally be caught by verifyToken, but as a safeguard:
    return res.status(401).json({ message: 'Unauthorized. User not found in request.' });
  }

  // Return the user's profile information.
  // Be careful not to send sensitive information like passwords if they were part of the user object.
  // Our mockUserStore user object is safe.
  res.json({
    message: 'Profile retrieved successfully!',
    user: req.user // req.user is set by the jwtStrategy via verifyToken
  });
});

module.exports = router;
