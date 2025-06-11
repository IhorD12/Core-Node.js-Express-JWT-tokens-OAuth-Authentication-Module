// config/index.js
/**
 * @fileoverview Loads and exports application configuration from environment variables.
 * Uses dotenv to load variables from a .env file into process.env.
 * Validates critical environment variables using Joi.
 */
const dotenv = require('dotenv');
const Joi = require('joi');

// Load .env file first
dotenv.config();

// Define schema for environment variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().required().min(32)
    .messages({
      'any.required': 'JWT_SECRET is required for token signing and must be at least 32 characters long.',
      'string.min': 'JWT_SECRET must be at least 32 characters long.'
    }),
  GOOGLE_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().required(),
    otherwise: Joi.optional().allow('')
  }).messages({ 'any.required': 'GOOGLE_CLIENT_ID is required for Google OAuth in development/production.' }),
  GOOGLE_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().required(),
    otherwise: Joi.optional().allow('')
  }).messages({ 'any.required': 'GOOGLE_CLIENT_SECRET is required for Google OAuth in development/production.' }),
  FACEBOOK_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().required(),
    otherwise: Joi.optional().allow('')
  }).messages({ 'any.required': 'FACEBOOK_CLIENT_ID is required for Facebook OAuth in development/production.' }),
  FACEBOOK_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().required(),
    otherwise: Joi.optional().allow('')
  }).messages({ 'any.required': 'FACEBOOK_CLIENT_SECRET is required for Facebook OAuth in development/production.' }),
  CORS_ALLOWED_ORIGINS: Joi.string().optional().allow(''), // Validated as string, processed later
  REFRESH_TOKEN_EXPIRATION_SECONDS: Joi.number().integer().positive().default(7 * 24 * 60 * 60), // 7 days in seconds
})
.unknown(true); // Allow other environment variables not defined in the schema

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  console.error(`\n!!! Environment variable validation error: ${error.message} !!!\n`);
  // For JWT_SECRET, it's always critical.
  if (error.details.some(d => d.path.includes('JWT_SECRET'))) {
    console.error('Application will exit due to missing or invalid JWT_SECRET.');
    process.exit(1);
  }
  // For OAuth IDs/secrets, only exit if not in 'test' mode and the variable was required
  const oauthPaths = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'];
  const isMissingRequiredOauth = error.details.some(d =>
    oauthPaths.includes(d.path[0]) && d.type === 'any.required'
  );

  if (isMissingRequiredOauth && envVars.NODE_ENV !== 'test') {
    console.error('Required OAuth client IDs/secrets are missing for non-test environment. Application will exit.');
    process.exit(1);
  }
  // If errors are not critical (e.g. optional fields in test mode), just log them but continue
}

// Process CORS_ALLOWED_ORIGINS from string to array
let processedCorsOrigins;
if (envVars.CORS_ALLOWED_ORIGINS && typeof envVars.CORS_ALLOWED_ORIGINS === 'string' && envVars.CORS_ALLOWED_ORIGINS.trim() !== '') {
  processedCorsOrigins = envVars.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(origin => origin);
  if (processedCorsOrigins.length === 0 && envVars.CORS_ALLOWED_ORIGINS.trim() !== '') {
    // This case handles if CORS_ALLOWED_ORIGINS was e.g. ",," - resulting in empty array but was not truly empty.
    // Defaulting to a restrictive but functional value or logging a specific warning might be better.
    // For now, if it was set but processed to empty, we reflect that (app.js has its own default).
    processedCorsOrigins = [];
  }
} else {
  // Default applied in app.js if this results in undefined or empty array.
  // Let's provide a default here as well for consistency from the config object.
  processedCorsOrigins = ['http://localhost:3001'];
}


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
 * @property {string[]} corsAllowedOrigins - Array of allowed origins for CORS.
 */
module.exports = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  jwtSecret: envVars.JWT_SECRET,
  googleClientId: envVars.GOOGLE_CLIENT_ID,
  googleClientSecret: envVars.GOOGLE_CLIENT_SECRET,
  facebookClientId: envVars.FACEBOOK_CLIENT_ID,
  facebookClientSecret: envVars.FACEBOOK_CLIENT_SECRET,
  corsAllowedOrigins: processedCorsOrigins,
  refreshTokenExpirationSeconds: envVars.REFRESH_TOKEN_EXPIRATION_SECONDS,
};
