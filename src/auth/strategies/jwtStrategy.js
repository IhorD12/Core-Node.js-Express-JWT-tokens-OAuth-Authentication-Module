// src/auth/strategies/jwtStrategy.js
/**
 * @fileoverview Passport JWT Strategy Configuration Function.
 * Returns a Passport strategy instance for verifying JWT access tokens.
 */
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { jwtSecret: defaultJwtSecret } = require('../../../config'); // Default secret from main config

/**
 * Configures and returns a JWT Passport strategy.
 * @param {object} options - Strategy options. Can override jwtSecret.
 * @param {string} [options.jwtSecret] - Secret for verifying JWT. Defaults to global config.
 * @param {object} services - Services container.
 * @param {import('../../services/userService')} services.userService - User service instance.
 * @returns {import('passport').Strategy} Configured Passport JWT strategy instance.
 */
const configureStrategy = (options = {}, services) => {
  const currentJwtSecret = options.jwtSecret || defaultJwtSecret;

  if (!currentJwtSecret) {
    throw new Error('JWT_SECRET is not defined for JWT strategy.');
  }
  if (!services || !services.userService) {
    throw new Error('userService must be provided to JWT strategy.');
  }

  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: currentJwtSecret,
  };

  return new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      if (jwt_payload.type !== 'access') {
        return done(null, false, { message: 'Invalid token type. Expected access token.' });
      }

      const user = await services.userService.findUserById(jwt_payload.sub);
      if (user) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'User not found.' });
      }
    } catch (error) {
      return done(error, false);
    }
  });
};

module.exports = configureStrategy;
