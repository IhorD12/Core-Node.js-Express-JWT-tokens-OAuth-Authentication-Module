// src/server.ts
/**
 * @fileoverview Server startup script.
 * Imports the Express app and starts listening on the configured port.
 * Includes graceful shutdown logic.
 */
import http from 'http'; // For typing the server instance
import mongoose from 'mongoose'; // Required for MongoDB disconnection
import app from './app'; // Import the Express Application from app.ts
import config from '@config/index'; // Path alias for config
import logger from '@config/logger'; // Path alias for logger
import PostgresUserAdapter from '@adapters/postgresUserAdapter'; // For PostgreSQL disconnection

const { port: configPort, nodeEnv, userStoreType } = config;

const PORT: number = (typeof configPort === 'string' ? parseInt(configPort, 10) : configPort) || 3000;
let server: http.Server; // To store the server instance

// Start the server only if not in 'test' environment
if (nodeEnv !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Server running in ${nodeEnv} mode on http://localhost:${PORT}`);
    logger.info(`JWT_SECRET loaded: ${!!config.jwtSecret ? 'Yes' : 'No - WARNING!'}`);

    // Log status of OAuth credentials based on whether they are configured
    config.oauthProviders.forEach(provider => {
      if (provider.options.clientID && provider.options.clientSecret) {
        logger.info(`${provider.name} Client ID loaded: Yes`);
      } else {
        // This warning is relevant if the provider is meant to be enabled but credentials are missing
        logger.warn(`${provider.name} Client ID or Secret loaded: No - WARNING (${provider.name} Auth may fail if used)!`);
      }
    });

    if (userStoreType === 'mongodb' && !config.mongoUri) {
        logger.error('MongoDB store type selected, but MONGO_URI is missing!');
    }
    if (userStoreType === 'postgres' && !config.postgresUri) {
        logger.error('PostgreSQL store type selected, but POSTGRES_URI is missing!');
    }

  });
} else {
  logger.info('Server not started in test mode. App is exported from app.ts.');
}

const gracefulShutdown = (signal: string): void => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close((err?: Error) => { // Add optional error parameter type
      if (err) {
        logger.error('Error during HTTP server close:', err);
      } else {
        logger.info('HTTP server closed.');
      }

      // Close database connection(s)
      let dbClosedPromise: Promise<any> = Promise.resolve();

      if (userStoreType === 'mongodb' && mongoose.connection.readyState !== 0) { // Check if connection is active
        dbClosedPromise = mongoose.disconnect()
          .then(() => logger.info('MongoDB connection closed successfully.'))
          .catch(dbErr => {
            logger.error('Error closing MongoDB connection:', dbErr);
            throw dbErr;
          });
      } else if (userStoreType === 'postgres') {
        // Assuming PostgresUserAdapter.shutdownPool() is static and handles null pool
        dbClosedPromise = PostgresUserAdapter.shutdownPool()
          .catch(dbErr => {
            logger.error('Error closing PostgreSQL pool:', dbErr);
            throw dbErr;
          });
      }

      dbClosedPromise
        .catch(() => { /* Errors already logged, prevent unhandled rejection */ })
        .finally(() => {
          logger.info('Application shut down.');
          process.exit(err ? 1 : 0); // Exit with error if server.close had an error
        });
    });

    const shutdownTimeout: number = 10000; // 10 seconds
    const timer = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, shutdownTimeout);

    server.on('close', () => {
        clearTimeout(timer);
    });

  } else {
    logger.info('No active server to shut down. Exiting.');
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.stack || reason });
  // Optionally exit, but be cautious in production
  // process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', { message: error.message, stack: error.stack });
  if (server && server.listening) {
    server.close(() => {
      logger.info('HTTP server closed due to uncaught exception.');
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 5000); // Force exit if server.close hangs
  } else {
    process.exit(1);
  }
});

// server.ts is an executable script, it doesn't typically export 'app'.
// 'app' is exported from 'app.ts'.
