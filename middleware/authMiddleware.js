// middleware/authMiddleware.js
const passport = require('passport');

/**
 * @fileoverview Authentication middleware using Passport JWT strategy.
 */

/**
 * Middleware to verify JWT and protect routes.
 * It uses `passport.authenticate` with the 'jwt' strategy.
 * If authentication is successful, the user object is attached to `req.user`.
 * If authentication fails (e.g., no token, invalid token, expired token),
 * it returns a 401 Unauthorized error with a JSON message.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
const verifyToken = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      // Passport strategy error (e.g., malformed token, DB error during user lookup)
      console.error('JWT Authentication Error:', err);
      return res.status(500).json({ message: 'Authentication error.', error: err.message });
    }
    if (!user) {
      // Authentication failed (e.g., token invalid, expired, or user not found)
      // info might contain details like 'No auth token' or 'User not found.' or 'jwt expired'
      let message = 'Unauthorized';
      if (info && info.message) {
        message = info.message;
      }
      if (info && info.name === 'TokenExpiredError') {
         message = 'Token expired. Please log in again.';
      } else if (info && info.name === 'JsonWebTokenError') {
         message = 'Invalid token. Please log in again.';
      }

      return res.status(401).json({ message });
    }
    // Authentication successful, user object is attached to the request
    req.user = user;
    return next();
  })(req, res, next); // Important: call the middleware function returned by passport.authenticate
};

module.exports = {
  verifyToken,
};
