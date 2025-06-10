// auth/tokenUtils.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config'); // Assuming config/index.js will be created

/**
 * Generates a JWT for a given user.
 * @param {object} user - The user object (e.g., { id: '123', email: 'test@example.com' }).
 * @returns {string} The generated JWT.
 * @throws {Error} If JWT secret is not defined.
 */
const generateToken = (user) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined. Please set it in your .env file.');
  }
  const payload = {
    sub: user.id, // Standard claim: subject (user identifier)
    iat: Math.floor(Date.now() / 1000), // Standard claim: issued at
    // exp: Math.floor(Date.now() / 1000) + (60 * 60), // Standard claim: expiration time (e.g., 1 hour)
    // For now, let's make tokens expire in 5 minutes for easier testing of expiration
    exp: Math.floor(Date.now() / 1000) + (5 * 60),
    email: user.email, // Example of including other user details
    // No custom scopes needed as per requirements
  };
  return jwt.sign(payload, jwtSecret);
};

module.exports = { generateToken };
