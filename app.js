// app.js
const express = require('express');
const { nodeEnv, port } = require('./config'); // Using destructuring for clarity
const initializePassport = require('./auth/passportSetup');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes'); // Ensure this is correctly named if it's /auth/profile

/**
 * @fileoverview Main application file for the Express server.
 * Initializes the app, sets up middleware, routes, and error handling.
 */

const app = express();

// --- Pre-Middleware Setup ---
// Load environment variables (already done by './config' an initial load)
// console.log(`NODE_ENV: ${nodeEnv}`); // For debugging

// --- Core Middleware ---
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies (optional, but good practice)
app.use(express.urlencoded({ extended: true }));

// --- Passport Configuration ---
// Initialize Passport and configure strategies.
// This function should call app.use(passport.initialize()) internally.
initializePassport(app);

// --- Application Routes ---
// Mount authentication routes (e.g., /auth/google, /auth/facebook)
app.use('/auth', authRoutes);
// Mount profile routes (e.g., /auth/profile)
// If profileRoutes handles '/profile', and authRoutes handles '/auth',
// then to get '/auth/profile', it should be mounted like this:
app.use('/auth', profileRoutes); // This will make routes in profileRoutes available under /auth prefix

// --- Basic Welcome Route ---
/**
 * @route GET /
 * @description Welcome message for the API.
 * @access Public
 */
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Modular Authentication API!' });
});

// --- Error Handling Middleware ---
/**
 * Catch-all middleware for 404 Not Found errors.
 * This middleware is triggered if no other route matches.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function (unused here).
 */
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found.' });
});

/**
 * Generic error handling middleware (should be the last middleware).
 * This catches errors passed by `next(err)` or thrown synchronously in route handlers.
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function (unused here, but required for Express to recognize it as an error handler).
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err.message || err);

  // Default to 500 server error
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';

  // Handle specific error types if needed
  if (err.name === 'UnauthorizedError') { // Example: error from express-jwt if it were used directly
    statusCode = 401;
    message = 'Invalid token or credentials.';
  }

  res.status(statusCode).json({
    message: message,
    // Optionally include error stack in development
    ...(nodeEnv === 'development' && { errorDetails: err.stack }),
  });
});

// --- Server Initialization (moved to server.js for better separation) ---
// const PORT = port || 3000;
// if (nodeEnv !== 'test') { // Don't start server if in test environment (tests will start their own)
//   app.listen(PORT, () => {
//     console.log(`Server running in ${nodeEnv} mode on port ${PORT}`);
//   });
// }

module.exports = app; // Export app for testing and potential server.js
