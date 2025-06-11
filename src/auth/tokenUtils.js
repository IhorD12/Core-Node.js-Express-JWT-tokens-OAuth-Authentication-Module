// src/auth/tokenUtils.js
/**
 * @fileoverview Utilities for JWT generation, including access and refresh tokens.
 */
const jwt = require('jsonwebtoken');
// jwtSecret and refreshTokenExpirationSeconds will be re-required inside generateAuthTokens
// to ensure fresh values from config, especially useful in scenarios where config might be updated.
// nodeEnv is used for determining access token expiry.
const { nodeEnv } = require('../../config');

// Access token expiration (e.g., 15 minutes for access token)
// Shorter for tests to make expiration testing feasible.
const ACCESS_TOKEN_EXPIRATION_SECONDS = (nodeEnv === 'test' ? 5 * 60 : 15 * 60);

/**
 * Generates an access token for a given user.
 * @param {object} user - The user object (e.g., { id: '123', email: 'test@example.com' }).
 * @param {string} secret - The JWT secret.
 * @param {number} expiresInSeconds - Expiration time in seconds.
 * @returns {string} The generated JWT access token.
 * @throws {Error} If user or user.id is missing.
 */
const generateAccessToken = (user, secret, expiresInSeconds) => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate access token.');
  }
  const payload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    email: user.email, // Include email for convenience in decoded access token
    type: 'access', // Add type claim for access tokens
    // provider: user.provider // Optionally include provider
  };
  return jwt.sign(payload, secret);
};

/**
 * Generates a refresh token for a given user.
 * @param {object} user - The user object, must contain an id.
 * @param {string} secret - The JWT secret.
 * @param {number} expiresInSeconds - Expiration time in seconds for the refresh token.
 * @returns {string} The generated JWT refresh token.
 * @throws {Error} If user or user.id is missing.
 */
const generateRefreshToken = (user, secret, expiresInSeconds) => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate refresh token.');
  }
  const payload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    type: 'refresh', // Differentiate refresh tokens from access tokens
  };
  return jwt.sign(payload, secret);
};

/**
 * Generates both access and refresh tokens for a user.
 * Retrieves JWT_SECRET and REFRESH_TOKEN_EXPIRATION_SECONDS from config.
 * Access token: short-lived, contains user details for API access.
 * Refresh token: long-lived, used to obtain new access tokens.
 * @param {object} user - User object (e.g., { id: '123', email: 'test@example.com' }).
 * @returns {{ accessToken: string, refreshToken: string }}
 * @throws {Error} If JWT_SECRET is not defined or user is invalid.
 */
const generateAuthTokens = (user) => {
  // Re-require config here to get the potentially updated/validated values,
  // especially if config module does complex loading or validation that runs once.
  const config = require('../../config');
  const { jwtSecret, refreshTokenExpirationSeconds } = config;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined. Please set it in your .env file.');
  }
  if (!refreshTokenExpirationSeconds) {
    // This should ideally be caught by config validation, but as a safeguard:
    throw new Error('REFRESH_TOKEN_EXPIRATION_SECONDS is not defined in config.');
  }
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate tokens.');
  }

  const accessToken = generateAccessToken(user, jwtSecret, ACCESS_TOKEN_EXPIRATION_SECONDS);
  const refreshToken = generateRefreshToken(user, jwtSecret, refreshTokenExpirationSeconds);

  return { accessToken, refreshToken };
};

/**
 * Generates a JWT (access token) for a given user.
 * @deprecated Use generateAuthTokens to get both access and refresh tokens. This function will be removed in a future version.
 * @param {object} user - The user object (e.g., { id: '123', email: 'test@example.com' }).
 * @returns {string} The generated JWT.
 * @throws {Error} If JWT_SECRET is not defined or user is invalid.
 */
const generateToken = (user) => {
  console.warn("DEPRECATED: generateToken is deprecated. Use generateAuthTokens instead. This function will be removed in a future version.");
  const { jwtSecret } = require('../../config'); // Re-require for safety, as above.
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined.');
  }
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate token.');
  }
  return generateAccessToken(user, jwtSecret, ACCESS_TOKEN_EXPIRATION_SECONDS);
};

module.exports = {
  generateToken, // Kept for backward compatibility with existing tests, marked deprecated
  generateAuthTokens,
  generateAccessToken, // Exported for potential direct use or more granular testing
  generateRefreshToken // Exported for potential direct use or more granular testing
};
