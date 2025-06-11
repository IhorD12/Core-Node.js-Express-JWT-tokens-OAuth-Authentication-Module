// src/middleware/rbacMiddleware.js
const logger = require('../config/logger'); // Adjusted path to logger

/**
 * @fileoverview Middleware for Role-Based Access Control (RBAC).
 */

/**
 * Creates a middleware function that checks if the authenticated user has at least one of the required roles.
 * @param {string|string[]} requiredRolesParam - A single role string or an array of allowed role strings.
 * @returns {function} Express middleware function.
 */
const checkRoles = (requiredRolesParam) => {
  const rolesToCheck = Array.isArray(requiredRolesParam) ? requiredRolesParam : [requiredRolesParam];

  if (rolesToCheck.some(role => typeof role !== 'string' || role.trim() === '')) {
    // This is a server configuration error
    logger.error('RBAC checkRoles middleware configured with invalid role(s). Each role must be a non-empty string.', { requiredRolesParam });
    // Block all access through this misconfigured middleware instance
    return (req, res, next) => {
        return res.status(500).json({ message: 'Internal Server Error: RBAC misconfiguration.' });
    };
  }

  if (rolesToCheck.length === 0) {
    logger.warn('RBAC checkRoles middleware used with no required roles specified. Allowing access by default, but this might be unintentional.');
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Ensure req.user and req.user.roles exist and req.user.roles is an array
    if (!req.user || !Array.isArray(req.user.roles) || req.user.roles.length === 0) {
      logger.warn('RBAC: User object or user.roles array not found or empty on request. Denying access.', {
        userId: req.user ? req.user.id : 'unknown',
        path: req.originalUrl
      });
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
    }

    const hasRequiredRole = req.user.roles.some(userRole => rolesToCheck.includes(userRole));

    if (hasRequiredRole) {
      return next(); // User has at least one of the required roles
    }

    logger.warn('RBAC: User does not have required role(s). Access denied.', {
      userId: req.user.id,
      userRoles: req.user.roles,
      requiredRoles: rolesToCheck,
      path: req.originalUrl,
    });
    return res.status(403).json({ message: 'Forbidden: You do not have the required permissions.' });
  };
};

module.exports = { checkRoles };
