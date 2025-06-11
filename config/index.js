// config/index.js
/**
 * @fileoverview Loads and exports application configuration from environment variables.
 * Uses dotenv to load variables from a .env file into process.env.
 */
const dotenv = require('dotenv');
dotenv.config();

/**
 * Application configuration object.
 * @type {object}
 * @property {string} nodeEnv - The current Node environment (e.g., 'development', 'production', 'test').
 * @property {string|number} port - The port on which the application server will listen.
 * @property {string} jwtSecret - Secret key for signing and verifying JWTs.
 * @property {string} googleClientId - Google OAuth Client ID.
 * @property {string} googleClientSecret - Google OAuth Client Secret.
 * @property {string} facebookClientId - Facebook App ID for OAuth.
 * @property {string} facebookClientSecret - Facebook App Secret for OAuth.
 */
module.exports = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  facebookClientId: process.env.FACEBOOK_CLIENT_ID,
  facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET,
};
