// src/middleware/authMiddleware.ts
import passport from 'passport';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias for custom request type
import { UserProfile } from '@adapters/userStoreAdapter'; // Path alias
import logger from '@config/logger'; // Path alias

/**
 * @fileoverview Authentication middleware using Passport JWT strategy.
 */

// Define a type for the 'info' object passed by passport.authenticate callback
// This can be more specific if the structure of 'info' from passport-jwt is known.
// For example, from `passport-jwt` it might be `VerifiedCallbackInfo` or similar.
// For now, a general type.
interface AuthInfo {
  message?: string;
  name?: string; // For error names like TokenExpiredError
}

/**
 * Middleware to verify JWT and protect routes.
 * It uses `passport.authenticate` with the 'jwt' strategy.
 * If authentication is successful, the user object is attached to `req.user`.
 * If authentication fails (e.g., no token, invalid token, expired token),
 * it returns a 401 Unauthorized error with a JSON message.
 *
 * @param {AuthenticatedRequest} req - Express request object, potentially with user.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 */
export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false },
    (err: any, user: UserProfile | false, info: AuthInfo | undefined) => {

    if (err) {
      logger.error('JWT Authentication Strategy Error:', {
        message: err.message || err.toString(),
        stack: err.stack,
        path: req.originalUrl,
        ip: req.ip // Added client IP
      });
      return res.status(500).json({ message: 'Authentication error.', error: err.message });
    }

    if (!user) {
      let responseMessage = 'Unauthorized';
      if (info && typeof info.message === 'string') {
        responseMessage = info.message;
      }

      // Specific handling for common JWT error names passed in 'info' or 'err' by some strategies
      // Note: passport-jwt usually passes errors via `err` argument or specific info messages.
      // This logic might need adjustment based on how passport-jwt exactly reports these.
      if (info && info.name === 'TokenExpiredError') {
        responseMessage = 'Token expired. Please log in again.';
      } else if (info && info.name === 'JsonWebTokenError') {
        responseMessage = 'Invalid token. Please log in again.';
      }

      logger.warn('JWT Authentication Failed:', {
        reason: responseMessage,
        info: info,
        path: req.originalUrl,
        ip: req.ip
      });
      return res.status(401).json({ message: responseMessage });
    }

    req.user = user; // Attach user to request, req.user is now typed
    return next();

  })(req, res, next); // Important: call the middleware function returned by passport.authenticate
};

// No default export if you only have named exports like verifyToken
// If this was the only function, could use export default verifyToken;
// For consistency with multiple exports or future additions:
// module.exports = { verifyToken }; // CommonJS style
// For ES6 style with named exports:
// (already done by `export const verifyToken`)
