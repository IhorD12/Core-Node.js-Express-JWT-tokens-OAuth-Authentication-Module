// src/auth/strategies/facebookStrategy.js
/**
 * @fileoverview Facebook OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for Facebook.
 */
const { Strategy: FacebookStrategy } = require('passport-facebook');

/**
 * Configures and returns a Facebook OAuth2.0 Passport strategy.
 * @param {object} options - Strategy options (clientID, clientSecret, callbackURL, scope, profileFields).
 * @param {object} services - Services like userService, authService.
 * @param {import('../../services/userService')} services.userService - User service instance.
 * @param {import('../../services/authService')} services.authService - Auth service instance.
 * @returns {import('passport').Strategy} Configured Passport strategy instance.
 */
const configureStrategy = (options, services) => {
  if (!options || !options.clientID || !options.clientSecret || !options.callbackURL) {
    throw new Error('Missing required options for Facebook strategy (clientID, clientSecret, callbackURL).');
  }
  if (!services || !services.userService || !services.authService) {
    throw new Error('userService and authService must be provided to Facebook strategy.');
  }

  return new FacebookStrategy(
    {
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope: options.scope || ['email', 'public_profile'],
      profileFields: options.profileFields || ['id', 'displayName', 'emails', 'photos'],
      passReqToCallback: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.id) {
          return done(new Error("Facebook profile is invalid or missing ID."), false);
        }

        const user = await services.userService.findOrCreateUser(profile, 'facebook');
        if (!user) {
          return done(new Error("Could not find or create user via Facebook."), false);
        }

        const tokens = await services.authService.generateAndStoreAuthTokens(user);

        return done(null, { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      } catch (error) {
        console.error("Error in Facebook Strategy verification callback:", error);
        return done(error, false);
      }
    }
  );
};

module.exports = configureStrategy;
