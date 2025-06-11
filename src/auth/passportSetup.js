// auth/passportSetup.js
const passport = require('passport');
const { oauthProviders, jwtSecret } = require('../../config'); // Get new oauthProviders config and jwtSecret for JWT strategy
const userService = require('../services/userService'); // Services needed by strategies
const authService = require('../services/authService'); // Services needed by strategies
const logger = require('../../config/logger'); // Import logger

// Path to strategies directory (adjust if passportSetup.js moves)
const strategiesBasePath = './strategies/';

/**
 * @fileoverview Initializes and configures Passport.js with all authentication strategies.
 */

/**
 * Configures and initializes Passport.
 * This function should be called once when the application starts.
 * @param {import('express').Application} app - The Express application instance. Passport middleware will be initialized on this app.
 */
const initializePassport = (app) => {
  // Initialize Passport middleware if Express app is provided
  // For stateless JWT authentication, session support via Express is not strictly necessary
  // if all routes use passport.authenticate with session: false.
  // However, it's common practice to initialize it.
  if (app) {
    app.use(passport.initialize());
    // app.use(passport.session()); // Still not needed for JWT stateless auth
  }

  // Services to pass to strategy configurations
  const services = { userService, authService };

  // Configure JWT Strategy (remains largely the same but uses the new structure)
  try {
    const configureJwtStrategy = require(`${strategiesBasePath}jwtStrategy`);
    passport.use('jwt', configureJwtStrategy({ jwtSecret }, services)); // 'jwt' is the name used by authMiddleware
    logger.info('JWT strategy initialized.');
  } catch (e) {
    logger.error("Failed to load JWT strategy:", { message: e.message, stack: e.stack });
    // Decide if this is a fatal error for your app
  }

  // Dynamically configure OAuth strategies
  if (oauthProviders && Array.isArray(oauthProviders) && oauthProviders.length > 0) {
    oauthProviders.forEach(providerConfig => {
      if (!providerConfig.options || !providerConfig.options.clientID) {
        logger.warn(`OAuth provider ${providerConfig.name} is missing clientID, skipping.`);
        return;
      }
      try {
        const strategyConfigurator = require(providerConfig.strategyModulePath.replace('../auth/', './'));
        passport.use(providerConfig.name, strategyConfigurator(providerConfig.options, services));
        logger.info(`Passport strategy for '${providerConfig.name}' initialized.`);
      } catch (e) {
        logger.error(`Failed to load or configure strategy for ${providerConfig.name}:`, { message: e.message, stack: e.stack });
        // Optionally, decide if this is a fatal error
      }
    });
  } else {
    logger.warn("No OAuth providers configured or configuration is invalid. Skipping dynamic OAuth strategy setup.");
  }

  // NO Passport session serialization/deserialization needed for JWT-based stateless auth.
  // passport.serializeUser((user, done) => {
  //   done(null, user.id);
  // });
  //
  // passport.deserializeUser(async (id, done) => {
  //   try {
  //     const user = await findUserById(id);
  //     done(null, user);
  //   } catch (error) {
  //     done(error, null);
  //   }
  // });

  // console.log('Passport initialization complete.'); // More generic message
};

module.exports = initializePassport;
