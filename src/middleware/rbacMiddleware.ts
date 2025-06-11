// src/middleware/rbacMiddleware.ts
import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import logger from '@config/logger'; // Path alias

/**
 * @fileoverview Middleware for Role-Based Access Control (RBAC).
 */

/**
 * Creates a middleware function that checks if the authenticated user has at least one of the required roles.
 * @param {string | string[]} requiredRolesParam - A single role string or an array of allowed role strings.
 * @returns {RequestHandler} Express middleware function.
 */
export const checkRoles = (requiredRolesParam: string | string[]): RequestHandler => {
  const rolesToCheck: string[] = Array.isArray(requiredRolesParam)
    ? requiredRolesParam
    : [requiredRolesParam];

  // Validate roles configuration during middleware setup
  if (rolesToCheck.some(role => typeof role !== 'string' || role.trim() === '')) {
    const errorMsg = 'RBAC checkRoles middleware configured with invalid role(s). Each role must be a non-empty string.';
    logger.error(errorMsg, { requiredRolesParam });
    // This configuration error should ideally prevent server startup or be caught early.
    // Returning a middleware that always fails if misconfigured.
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Add types here
        return res.status(500).json({ message: 'Internal Server Error: RBAC misconfiguration.' });
    };
  }

  if (rolesToCheck.length === 0) {
    logger.warn('RBAC checkRoles middleware used with no required roles specified. Allowing access by default, but this might be unintentional.');
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => next(); // Add types here
  }

  // Return the actual middleware function
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !Array.isArray(req.user.roles) || req.user.roles.length === 0) {
      logger.warn('RBAC: User object or user.roles array not found or empty on request. Denying access.', {
        userId: req.user ? req.user.id : 'unknown',
        path: req.originalUrl,
        ip: req.ip
      });
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
    }

    const hasRequiredRole = req.user.roles.some((userRole: string) => rolesToCheck.includes(userRole));

    if (hasRequiredRole) {
      return next();
    }

    logger.warn('RBAC: User does not have required role(s). Access denied.', {
      userId: req.user.id,
      userRoles: req.user.roles,
      requiredRoles: rolesToCheck,
      path: req.originalUrl,
      ip: req.ip
    });
    return res.status(403).json({ message: 'Forbidden: You do not have the required permissions.' });
  };
};

// For ES6 style with named exports:
// (already done by `export const checkRoles`)
