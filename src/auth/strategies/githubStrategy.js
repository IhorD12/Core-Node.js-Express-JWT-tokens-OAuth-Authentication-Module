// src/auth/strategies/githubStrategy.js
/**
 * @fileoverview GitHub OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for GitHub.
 */
const { Strategy: GithubStrategy } = require('passport-github2');
const logger = require('../../../config/logger'); // Adjusted path for logger

/**
 * Configures and returns a GitHub OAuth2.0 Passport strategy.
 * @param {object} options - Strategy options from config (clientID, clientSecret, callbackURL, scope, customHeaders, authorizationURL, tokenURL, userProfileURL).
 * @param {object} services - Application services.
 * @param {import('../../services/userService')} services.userService - User service instance.
 * @param {import('../../services/authService')} services.authService - Auth service instance.
 * @returns {GithubStrategy} Configured Passport GitHub strategy instance.
 */
const configureStrategy = (options, services) => {
  if (!options || !options.clientID || !options.clientSecret || !options.callbackURL || !options.userProfileURL) {
    // Log this error as it indicates a configuration problem
    const errMsg = 'GitHub strategy requires clientID, clientSecret, callbackURL, and userProfileURL in options.';
    logger.error(errMsg, { optionsProvided: options });
    throw new Error(errMsg);
  }
  if (!services || !services.userService || !services.authService) {
    const errMsg = 'userService and authService must be provided to GitHub strategy.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  const strategyOptions = {
    clientID: options.clientID,
    clientSecret: options.clientSecret,
    callbackURL: options.callbackURL,
    scope: options.scope || ['user:email', 'read:user'], // Default scopes
    authorizationURL: options.authorizationURL,
    tokenURL: options.tokenURL,
    userProfileURL: options.userProfileURL,
    passReqToCallback: false,
    customHeaders: options.customHeaders || { 'User-Agent': 'NodeJsAuthModule/1.0' }
  };

  return new GithubStrategy(strategyOptions,
    async (accessToken, refreshToken, profile, done) => {
      // refreshToken from GitHub might be null or undefined; our authService generates its own.
      logger.debug('GitHub Profile received:', { profileId: profile.id, displayName: profile.displayName });

      try {
        if (!profile || !profile.id) {
          logger.warn('GitHub profile is invalid or missing ID.', { profile });
          return done(new Error("GitHub profile is invalid or missing ID."), false);
        }

        // Normalize profile data
        let primaryEmail = null;
        if (profile.emails && profile.emails.length > 0) {
            const primary = profile.emails.find(e => e.primary && e.verified);
            if (primary) {
              primaryEmail = primary.value;
            } else {
              const verifiedEmail = profile.emails.find(e => e.verified);
              if (verifiedEmail) primaryEmail = verifiedEmail.value;
              else primaryEmail = profile.emails[0].value; // Fallback to first email
            }
        } else if (profile._json && profile._json.email) {
            primaryEmail = profile._json.email;
        }

        const userProfileDetails = {
          provider: 'github',
          providerId: profile.id.toString(),
          displayName: profile.displayName || profile.username || `GitHubUser-${profile.id}`,
          email: primaryEmail,
          photo: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        };

        const user = await services.userService.findOrCreateUser(userProfileDetails);
        if (!user) {
          logger.error('Failed to find or create user from GitHub profile.', { profileDetails });
          return done(new Error("Could not find or create user from GitHub profile."), false);
        }

        const tokens = await services.authService.generateAndStoreAuthTokens(user);

        return done(null, { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

      } catch (error) {
        logger.error('Error in GitHub Strategy verification callback:', { error: error.message, stack: error.stack });
        return done(error, false);
      }
    }
  );
};

module.exports = configureStrategy; // Export the function directly
// The previous structure in problem description was module.exports = { configureStrategy }
// but passportSetup.js expects `require(path)` to return the function.
// If it returns an object, then passportSetup.js would need `require(path).configureStrategy`.
// Direct export of the function is simpler for the dynamic loader.
