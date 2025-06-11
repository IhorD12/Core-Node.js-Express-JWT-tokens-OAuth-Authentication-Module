// src/server.js
/**
 * @fileoverview Server startup script.
 * Imports the Express app and starts listening on the configured port.
 * Includes graceful shutdown logic.
 */
const app = require('./app');
const { port, nodeEnv, mongoUri, userStoreType } = require('../config'); // Added mongoUri and userStoreType
const logger = require('../config/logger'); // Correct path from src/server.js to src/config/logger.js
const mongoose = require('mongoose'); // Required for MongoDB disconnection
const PostgresUserAdapter = require('../adapters/postgresUserAdapter'); // For PostgreSQL disconnection

const PORT = port || 3000;
let server; // To store the server instance

// Start the server only if not in 'test' environment
if (nodeEnv !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Server running in ${nodeEnv} mode on http://localhost:${PORT}`);
    logger.info(`JWT_SECRET loaded: ${!!require('../config').jwtSecret ? 'Yes' : 'No - WARNING!'}`);
    if (!!require('../config').googleClientId) {
      logger.info('Google Client ID loaded: Yes');
    } else {
      // Only warn if Google provider is actually enabled in the config (if such a check exists)
      // For now, this warning is general if the ID is not set.
      logger.warn('Google Client ID loaded: No - WARNING (Google Auth may fail if enabled and used)!');
    }
    if (!!require('../config').facebookClientId) {
      logger.info('Facebook Client ID loaded: Yes');
    } else {
      logger.warn('Facebook Client ID loaded: No - WARNING (Facebook Auth may fail if enabled and used)!');
    }
  });
} else {
  logger.info('Server not started in test mode. App is exported from app.js.');
}

const gracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error during server close:', err);
        // process.exit(1); // Don't exit yet, try to close DB
      } else {
        logger.info('HTTP server closed.');
      }

      // Close database connection(s)
      let dbClosedPromise = Promise.resolve();
      if (userStoreType === 'mongodb') {
        dbClosedPromise = mongoose.disconnect()
          .then(() => logger.info('MongoDB connection closed successfully.'))
          .catch(dbErr => {
            logger.error('Error closing MongoDB connection:', dbErr);
            // Potentially set a flag to indicate db close error for process.exit code
            throw dbErr; // Re-throw to be caught by a final handler if needed
          });
      } else if (userStoreType === 'postgres') {
        dbClosedPromise = PostgresUserAdapter.shutdownPool()
          // shutdownPool already logs success/info
          .catch(dbErr => {
            logger.error('Error closing PostgreSQL pool:', dbErr);
            throw dbErr;
          });
      }

      dbClosedPromise.then(() => {
        logger.info('Application shut down successfully.');
        process.exit(err ? 1 : 0);
      }).catch(() => {
        // If any DB disconnection failed
        logger.error('Database disconnection failed during shutdown. Forcing exit.');
        process.exit(1);
      });
    });

    // Force close server after a timeout (e.g., 10 seconds)
    // if connections are still lingering
    const shutdownTimeout = 10000; // 10 seconds
    const timer = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down.');
      process.exit(1); // Exit with error
    }, shutdownTimeout);

    // If server.close() finishes, clear the timeout
    server.on('close', () => {
        clearTimeout(timer);
    });

  } else {
    // If server wasn't even started (e.g., in test mode or pre-listen error)
    logger.info('No active server to shut down. Exiting.');
    process.exit(0);
  }
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill command (default for Docker stop)

// Optional: Handle unhandled rejections and uncaught exceptions to log them
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason.stack || reason });
  // Application specific logging, throwing an error, or other logic here.
  // It's often recommended to exit if the application is in an unknown state.
  // For a graceful exit here, you might call gracefulShutdown, but often these are more abrupt.
  // process.exit(1); // Uncomment if you want to exit on unhandled rejections
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { message: error.message, stack: error.stack });
  // Application specific logging.
  // It is generally recommended to exit after an uncaught exception, as the application is in an undefined state.
  // Perform a more immediate shutdown if possible, but avoid gracefulShutdown if it might hang on a broken state.
  if (server && server.listening) {
    server.close(() => {
      logger.info('HTTP server closed due to uncaught exception.');
      process.exit(1);
    });
    // Force exit after timeout if server.close hangs
    setTimeout(() => process.exit(1), 5000);
  } else {
    process.exit(1);
  }
});

// server.js is primarily an executable. The Express app is exported from app.js.
// No module.exports = app; here.
