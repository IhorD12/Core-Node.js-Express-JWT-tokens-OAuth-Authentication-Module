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
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),

  // OAuth Endpoint URLs - with defaults for real providers
  GOOGLE_AUTHORIZATION_URL: Joi.string().uri().default('https://accounts.google.com/o/oauth2/v2/auth'),
  GOOGLE_TOKEN_URL: Joi.string().uri().default('https://oauth2.googleapis.com/token'),
  GOOGLE_USERINFO_URL: Joi.string().uri().default('https://www.googleapis.com/oauth2/v3/userinfo'),

  FACEBOOK_AUTHORIZATION_URL: Joi.string().uri().default('https://www.facebook.com/v19.0/dialog/oauth'),
  FACEBOOK_TOKEN_URL: Joi.string().uri().default('https://graph.facebook.com/v19.0/oauth/access_token'),
  FACEBOOK_USER_PROFILE_URL: Joi.string().uri().default('https://graph.facebook.com/me'),
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
 * @property {number} refreshTokenExpirationSeconds - Expiration time for refresh tokens in seconds.
 * @property {string} logLevel - The configured logging level for Winston.
 * @property {Array<object>} oauthProviders - Array of configured and enabled OAuth provider settings.
 * @property {string} oauthProviders[].name - Name of the OAuth provider (e.g., 'google').
 * @property {string} oauthProviders[].strategyModulePath - Path to the strategy configuration module.
 * @property {object} oauthProviders[].options - Options for the Passport strategy (clientID, clientSecret, callbackURL, scope, etc.).
 * @property {string} oauthProviders[].authPath - Path for initiating authentication (e.g., '/auth/google').
 * @property {string} oauthProviders[].callbackPath - Path for the OAuth callback (e.g., '/auth/google/callback').
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
  logLevel: envVars.LOG_LEVEL,
  // OAuth Provider Configurations
  oauthProviders: [
    {
      name: 'google',
      strategyModulePath: '../auth/strategies/googleStrategy', // Path for dynamic require in passportSetup
      options: {
        clientID: envVars.GOOGLE_CLIENT_ID,
        clientSecret: envVars.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback', // App's callback path
        scope: ['profile', 'email'],
        authorizationURL: envVars.GOOGLE_AUTHORIZATION_URL,
        tokenURL: envVars.GOOGLE_TOKEN_URL,
        userProfileURL: envVars.GOOGLE_USERINFO_URL, // Used by Google strategy
      },
      isEnabled: !!envVars.GOOGLE_CLIENT_ID && !!envVars.GOOGLE_CLIENT_SECRET,
      authPath: '/auth/google', // For generating routes
      callbackPath: '/auth/google/callback' // For generating routes
    },
    {
      name: 'facebook',
      strategyModulePath: '../auth/strategies/facebookStrategy',
      options: {
        clientID: envVars.FACEBOOK_CLIENT_ID,
        clientSecret: envVars.FACEBOOK_CLIENT_SECRET,
        callbackURL: '/auth/facebook/callback', // App's callback path
        scope: ['email', 'public_profile'],
        profileFields: ['id', 'displayName', 'emails', 'photos'],
        authorizationURL: envVars.FACEBOOK_AUTHORIZATION_URL,
        tokenURL: envVars.FACEBOOK_TOKEN_URL,
        profileURL: envVars.FACEBOOK_USER_PROFILE_URL, // Used by Facebook strategy
      },
      isEnabled: !!envVars.FACEBOOK_CLIENT_ID && !!envVars.FACEBOOK_CLIENT_SECRET,
      authPath: '/auth/facebook',
      callbackPath: '/auth/facebook/callback'
    },
    // Example for GitHub (stubbed, would require GITHUB_CLIENT_ID/SECRET in env and schema)
    // {
    //   name: 'github',
    //   strategyModulePath: '../auth/strategies/githubStrategy',
    //   options: {
    //     clientID: envVars.GITHUB_CLIENT_ID,
    //     clientSecret: envVars.GITHUB_CLIENT_SECRET,
    //     callbackURL: '/auth/github/callback',
    //     scope: ['user:email'],
    //   },
    //   isEnabled: !!envVars.GITHUB_CLIENT_ID && !!envVars.GITHUB_CLIENT_SECRET,
    //   authPath: '/auth/github',
    //   callbackPath: '/auth/github/callback'
    // },
  ].filter(p => p.isEnabled), // Filter out disabled providers before exporting
};
