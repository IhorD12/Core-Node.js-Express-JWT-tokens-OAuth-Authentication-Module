// src/services/authService.js
/**
 * @fileoverview Authentication Service for managing tokens and auth operations.
 */
const jwt = require('jsonwebtoken');
const { jwtSecret, refreshTokenExpirationSeconds, nodeEnv, userStoreType } = require('../../config');
const MockUserStore = require('../auth/mockUserStore');
const MongoUserAdapter = require('../adapters/mongoUserAdapter');
const PostgresUserAdapter = require('../adapters/postgresUserAdapter');
const userService = require('./userService'); // For user lookups

// Instantiate the store based on configuration
let userStore;
if (userStoreType === 'mongodb') {
  userStore = new MongoUserAdapter();
} else if (userStoreType === 'postgres') {
  userStore = new PostgresUserAdapter();
} else { // Default to mock store
  userStore = new MockUserStore();
}

// Access token expiration (e.g., 15 minutes for access token)
const ACCESS_TOKEN_EXPIRATION_SECONDS = (nodeEnv === 'test' ? 5 * 60 : 15 * 60);

/**
 * Generates an access token for a given user.
 * @param {object} user - User object (e.g., { id, email }).
 * @returns {string} JWT access token.
 */
const generateAccessToken = (user) => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate access token.');
  }
  const payload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRATION_SECONDS,
    email: user.email,
    type: 'access',
  };
  return jwt.sign(payload, jwtSecret);
};

/**
 * Generates a refresh token for a given user.
 * @param {object} user - User object (must contain id).
 * @returns {string} JWT refresh token.
 */
const generateRefreshToken = (user) => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate refresh token.');
  }
  const payload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + refreshTokenExpirationSeconds,
    type: 'refresh',
  };
  return jwt.sign(payload, jwtSecret);
};

/**
 * Generates and stores auth tokens (access and refresh) for a user.
 * @param {object} user - User object.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 * @throws {Error} If secrets are not defined or user is invalid.
 */
const generateAndStoreAuthTokens = async (user) => {
  if (!jwtSecret || !refreshTokenExpirationSeconds) {
    throw new Error('JWT secrets or expiration settings are not defined.');
  }
  if (!user || !user.id) {
    throw new Error('User object with an ID is required.');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await userStore.addRefreshToken(user.id, refreshToken); // Use adapter method
  return { accessToken, refreshToken };
};

/**
 * Refreshes authentication tokens using a provided valid refresh token.
 * Implements rolling refresh tokens. New tokens are generated, old refresh token is invalidated.
 * @param {string} providedRefreshToken - The refresh token from the client.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} New token pair.
 * @throws {Error} If refresh token is invalid, expired, not found, user is not found, or secrets are missing.
 *                 Error may have a `status` property (e.g., 400, 401) for HTTP responses.
 */
const refreshAuthTokens = async (providedRefreshToken) => {
  if (!providedRefreshToken) {
    throw new Error('Refresh token is required.');
  }

  const decoded = jwt.verify(providedRefreshToken, jwtSecret); // Throws if invalid/expired

  if (decoded.type !== 'refresh') {
    const err = new Error('Invalid token type. Expected refresh token.');
    err.status = 401; // Custom status for error handling
    throw err;
  }

  const userId = decoded.sub;
  const isValidInStore = await userStore.validateRefreshToken(userId, providedRefreshToken); // Use adapter method
  if (!isValidInStore) {
    const err = new Error('Refresh token not recognized or has been invalidated.');
    err.status = 401;
    throw err;
  }

  await userStore.removeRefreshToken(userId, providedRefreshToken);

  const user = await userService.findUserById(userId);
  if (!user) {
    const err = new Error('User not found for refresh token.');
    err.status = 401;
    throw err;
  }

  // Generate new pair
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await userStore.addRefreshToken(userId, newRefreshToken); // Use adapter method

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logs out a user by invalidating a specific refresh token.
 * @param {string} providedRefreshToken - The refresh token to invalidate.
 * @returns {Promise<boolean>} True if token was found and removed from the store, false otherwise.
 * @throws {Error} If token is malformed, signature is invalid, or type is not 'refresh'.
 *                 Error may have a `status` property (e.g., 401) for HTTP responses.
 */
const logoutUser = async (providedRefreshToken) => {
  if (!providedRefreshToken) {
    throw new Error('Refresh token is required for logout.');
  }

  // Ignore expiration for logout, but verify signature to get userId
  const decoded = jwt.verify(providedRefreshToken, jwtSecret, { ignoreExpiration: true });

  if (decoded.type !== 'refresh') {
     const err = new Error('Invalid token type. Expected refresh token for logout.');
     err.status = 401;
     throw err;
  }

  const userId = decoded.sub;
  return userStore.removeRefreshToken(userId, providedRefreshToken);
};

module.exports = {
  generateAccessToken, // May not be needed externally if generateAndStoreAuthTokens is primary
  generateRefreshToken, // May not be needed externally
  generateAndStoreAuthTokens,
  refreshAuthTokens,
  logoutUser,
};
