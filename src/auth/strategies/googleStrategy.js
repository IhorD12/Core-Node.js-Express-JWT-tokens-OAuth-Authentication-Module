// src/auth/strategies/googleStrategy.js
/**
 * @fileoverview Google OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for Google.
 */
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

/**
 * Configures and returns a Google OAuth2.0 Passport strategy.
 * @param {object} options - Strategy options (clientID, clientSecret, callbackURL, scope).
 * @param {object} services - Services like userService, authService.
 * @param {import('../../services/userService')} services.userService - User service instance.
 * @param {import('../../services/authService')} services.authService - Auth service instance.
 * @returns {import('passport').Strategy} Configured Passport strategy instance.
 */
const configureStrategy = (options, services) => {
  if (!options || !options.clientID || !options.clientSecret || !options.callbackURL) {
    throw new Error('Missing required options for Google strategy (clientID, clientSecret, callbackURL).');
  }
  if (!services || !services.userService || !services.authService) {
    throw new Error('userService and authService must be provided to Google strategy.');
  }

  return new GoogleStrategy(
    {
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope: options.scope || ['profile', 'email'],
      authorizationURL: options.authorizationURL, // Pass through from config
      tokenURL: options.tokenURL,                 // Pass through from config
      userProfileURL: options.userProfileURL,       // Pass through from config
      passReqToCallback: false,
    },
    async (accessToken, refreshToken, profile, done) => { // Standard Passport strategy callback
      try {
        if (!profile || !profile.id) {
          return done(new Error("Google profile is invalid or missing ID."), false);
        }

        const user = await services.userService.findOrCreateUser(profile, 'google');
        if (!user) {
          return done(new Error("Could not find or create user via Google."), false);
        }

        const tokens = await services.authService.generateAndStoreAuthTokens(user);

        return done(null, { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      } catch (error) {
        console.error("Error in Google Strategy verification callback:", error);
        return done(error, false);
      }
    }
  );
};

module.exports = configureStrategy;
