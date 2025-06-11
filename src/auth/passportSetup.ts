// src/auth/passportSetup.ts
import passport, { PassportStatic } from 'passport';
import { Express } from 'express';
import config from '@config/index'; // Path alias for config
import userService from '@services/userService'; // Path alias
import authService from '@services/authService'; // Path alias
import logger from '@config/logger'; // Path alias
import { UserService } from '@services/userService'; // Assuming type exports from services
import { AuthService } from '@services/authService';

const strategiesBasePath = './strategies/'; // Relative to this file's location in src/auth/

interface ServiceContainer {
  userService: UserService;
  authService: AuthService;
}

/**
 * @fileoverview Initializes and configures Passport.js with all authentication strategies.
 */

/**
 * Configures and initializes Passport.
 * This function should be called once when the application starts.
 * @param {Express} app - The Express application instance. Passport middleware will be initialized on this app.
 */
const initializePassport = (app: Express): void => {
  if (app) {
    app.use(passport.initialize());
  }

  const services: ServiceContainer = { userService, authService };

  // Configure JWT Strategy
  try {
    // Assuming strategy files now export a default function `configureStrategy`
    const configureJwtStrategy = require(`${strategiesBasePath}jwtStrategy`).default;
    (passport as PassportStatic).use('jwt', configureJwtStrategy({ jwtSecret: config.jwtSecret }, services));
    logger.info('JWT strategy initialized.');
  } catch (e: any) {
    logger.error('Failed to load JWT strategy:', { message: e.message, stack: e.stack });
  }

  // Dynamically configure OAuth strategies
  if (config.oauthProviders && Array.isArray(config.oauthProviders) && config.oauthProviders.length > 0) {
    config.oauthProviders.forEach(providerConfig => {
      if (!providerConfig.options || !providerConfig.options.clientID) {
        logger.warn(`OAuth provider ${providerConfig.name} is missing clientID, skipping.`);
        return;
      }
      try {
        // Adjust path for require: config stores path relative to project root or a common point
        // e.g., if strategyModulePath is '../auth/strategies/googleStrategy'
        // from this file (src/auth/passportSetup.ts), it becomes './strategies/googleStrategy'
        const correctedModulePath = providerConfig.strategyModulePath.replace('../auth/', './');
        const strategyConfigurator = require(correctedModulePath).default; // .default if strategy files use `export default`

        const strategyOptionsWithProviderName = {
          ...providerConfig.options,
          providerName: providerConfig.name, // Pass provider name for logging/context
        };

        (passport as PassportStatic).use(providerConfig.name, strategyConfigurator(strategyOptionsWithProviderName, services));
        logger.info(`Passport strategy for '${providerConfig.name}' initialized.`);
      } catch (e: any) {
        logger.error(`Failed to load or configure strategy for ${providerConfig.name}:`, { message: e.message, stack: e.stack });
      }
    });
  } else {
    logger.warn("No OAuth providers configured or configuration is invalid. Skipping dynamic OAuth strategy setup.");
  }

  // Session serialization/deserialization is not used with JWTs.
  // logger.info('Passport initialization complete.');
};

export default initializePassport;
