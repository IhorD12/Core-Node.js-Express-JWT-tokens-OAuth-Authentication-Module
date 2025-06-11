// config/index.ts
/**
 * @fileoverview Loads and exports application configuration from environment variables.
 * Uses dotenv to load variables from a .env file into process.env.
 * Validates critical environment variables using Joi.
 */
import dotenv from 'dotenv';
import Joi from 'joi';

// Load .env file first
dotenv.config();

// Define interfaces for structure clarity (optional but good practice)
interface OAuthProviderOptionDetails {
  providerName?: string; // To pass the provider name into the strategy options
  clientID?: string;
  clientSecret?: string;
  callbackURL: string;
  scope: string | string[];
  authorizationURL?: string;
  tokenURL?: string;
  userProfileURL?: string; // For Google, GitHub
  profileURL?: string; // For Facebook
  profileFields?: string[]; // For Facebook
  customHeaders?: Record<string, string>; // For GitHub User-Agent
}

interface OAuthProviderConfig {
  name: string;
  strategyModulePath: string;
  options: OAuthProviderOptionDetails;
  isEnabled: boolean;
  authPath: string;
  callbackPath: string;
}

// Define schema for environment variables
// Joi types will be inferred by TypeScript to some extent
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'RS256').default('HS256'),
  JWT_SECRET: Joi.string().when('JWT_ALGORITHM', {
    is: 'HS256',
    then: Joi.string().required().min(32).messages({
      'any.required': 'JWT_SECRET is required for HS256 token signing and must be at least 32 characters long.',
      'string.min': 'JWT_SECRET must be at least 32 characters long for HS256.'
    }),
    otherwise: Joi.optional().allow(null, ''),
  }),
  JWT_PRIVATE_KEY: Joi.string().when('JWT_ALGORITHM', {
    is: 'RS256',
    then: Joi.string().required().custom((value, helpers) => {
      if (!value.includes('-----BEGIN RSA PRIVATE KEY-----') && !value.includes('-----BEGIN PRIVATE KEY-----')) { // Allow both common PEM headers
        return helpers.error('string.pattern.base', { pattern: 'PEM RSA private key format' });
      }
      return value;
    }).messages({ 'any.required': 'JWT_PRIVATE_KEY is required for RS256 algorithm.' }),
    otherwise: Joi.optional().allow(null, ''),
  }),
  JWT_PUBLIC_KEY: Joi.string().when('JWT_ALGORITHM', {
    is: 'RS256',
    then: Joi.string().required().custom((value, helpers) => {
      if (!value.includes('-----BEGIN PUBLIC KEY-----') && !value.includes('-----BEGIN RSA PUBLIC KEY-----')) { // Allow both common PEM headers
        return helpers.error('string.pattern.base', { pattern: 'PEM public key format' });
      }
      return value;
    }).messages({ 'any.required': 'JWT_PUBLIC_KEY is required for RS256 algorithm.' }),
    otherwise: Joi.optional().allow(null, ''),
  }),
  GOOGLE_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''), // Allow empty for now, rely on isEnabled logic
    otherwise: Joi.optional().allow('')
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''),
    otherwise: Joi.optional().allow('')
  }),
  FACEBOOK_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''),
    otherwise: Joi.optional().allow('')
  }),
  FACEBOOK_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''),
    otherwise: Joi.optional().allow('')
  }),
  GITHUB_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''),
    otherwise: Joi.optional().allow('')
  }),
  GITHUB_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('development', 'production'),
    then: Joi.string().allow(''),
    otherwise: Joi.optional().allow('')
  }),
  CORS_ALLOWED_ORIGINS: Joi.string().optional().allow(''),
  REFRESH_TOKEN_EXPIRATION_SECONDS: Joi.number().integer().positive().default(7 * 24 * 60 * 60),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  APP_NAME: Joi.string().default('Node.js Auth Module'),

  GOOGLE_AUTHORIZATION_URL: Joi.string().uri().default('https://accounts.google.com/o/oauth2/v2/auth'),
  GOOGLE_TOKEN_URL: Joi.string().uri().default('https://oauth2.googleapis.com/token'),
  GOOGLE_USERINFO_URL: Joi.string().uri().default('https://www.googleapis.com/oauth2/v3/userinfo'),
  FACEBOOK_AUTHORIZATION_URL: Joi.string().uri().default('https://www.facebook.com/v19.0/dialog/oauth'),
  FACEBOOK_TOKEN_URL: Joi.string().uri().default('https://graph.facebook.com/v19.0/oauth/access_token'),
  FACEBOOK_USER_PROFILE_URL: Joi.string().uri().default('https://graph.facebook.com/me'),
  GITHUB_AUTHORIZATION_URL: Joi.string().uri().default('https://github.com/login/oauth/authorize'),
  GITHUB_TOKEN_URL: Joi.string().uri().default('https://github.com/login/oauth/access_token'),
  GITHUB_USER_PROFILE_URL: Joi.string().uri().default('https://api.github.com/user'),

  USER_STORE_TYPE: Joi.string().valid('mongodb', 'mock', 'postgres').default('mock'),
  MONGO_URI: Joi.string().when('USER_STORE_TYPE', {
    is: 'mongodb',
    then: Joi.string().required().uri({ scheme: ['mongodb', 'mongodb+srv'] }),
    otherwise: Joi.optional().allow('')
  }).default('mongodb://localhost:27017/auth_module_dev')
    .messages({ 'any.required': 'MONGO_URI is required when USER_STORE_TYPE is mongodb.' }),
  POSTGRES_URI: Joi.string().when('USER_STORE_TYPE', {
    is: 'postgres',
    then: Joi.string().required().uri({ scheme: ['postgresql', 'postgres'] }),
    otherwise: Joi.optional().allow('')
  }).default('postgresql://user:password@localhost:5432/auth_module_dev')
    .messages({ 'any.required': 'POSTGRES_URI is required when USER_STORE_TYPE is postgres.' }),

  REFRESH_TOKEN_COOKIE_NAME: Joi.string().token().pattern(/^[a-zA-Z0-9_.-]+$/).default('jid_rt'),
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS: Joi.number().integer().positive().default(7 * 24 * 60 * 60 * 1000), // 7 days
  REFRESH_TOKEN_COOKIE_SAMESITE: Joi.string().valid('Strict', 'Lax', 'None', 'strict', 'lax', 'none').default('Lax'),
})
.unknown(true);

// Explicitly type process.env for validation to avoid implicit any
const envsToValidate: Record<string, string | undefined> = { ...process.env };
const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(envsToValidate);

if (error) {
  console.error(`\n!!! Environment variable validation error: ${error.message} !!!\n`);
  if (error.details.some(d => d.path.includes('JWT_SECRET'))) {
    console.error('Application will exit due to missing or invalid JWT_SECRET.');
    process.exit(1);
  }
  const oauthPaths = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  const isMissingRequiredOauth = error.details.some(d =>
    oauthPaths.includes(d.path[0] as string) && d.type === 'any.required'
  );
  if (isMissingRequiredOauth && envVars.NODE_ENV !== 'test') {
    console.error('Required OAuth client IDs/secrets are missing for non-test environment. Application will exit.');
    process.exit(1);
  }
}

let processedCorsOrigins: string[];
if (envVars.CORS_ALLOWED_ORIGINS && typeof envVars.CORS_ALLOWED_ORIGINS === 'string' && envVars.CORS_ALLOWED_ORIGINS.trim() !== '') {
  processedCorsOrigins = envVars.CORS_ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim()).filter((origin: string) => origin);
  if (processedCorsOrigins.length === 0 && envVars.CORS_ALLOWED_ORIGINS.trim() !== '') {
    processedCorsOrigins = [];
  }
} else {
  processedCorsOrigins = ['http://localhost:3001'];
}

// Define the structure of the exported config object
// This should match the JSDoc from the previous JS version
export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  jwtAlgorithm: 'HS256' | 'RS256';
  jwtSecret?: string | null; // Optional if RS256
  jwtPrivateKey?: string | null;
  jwtPublicKey?: string | null;
  refreshTokenCookieName: string;
  refreshTokenCookieMaxAge: number;
  refreshTokenCookieSameSite: 'Strict' | 'Lax' | 'None'; // This is the type Express expects
  googleClientId?: string;
  googleClientSecret?: string;
  facebookClientId?: string;
  facebookClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  corsAllowedOrigins: string[];
  refreshTokenExpirationSeconds: number;
  logLevel: string;
  appName: string;
  mongoUri?: string;
  postgresUri?: string;
  userStoreType: 'mongodb' | 'mock' | 'postgres';
  oauthProviders: OAuthProviderConfig[];
}


const config: Config = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  jwtAlgorithm: envVars.JWT_ALGORITHM as 'HS256' | 'RS256',
  jwtSecret: envVars.JWT_SECRET,
  jwtPrivateKey: envVars.JWT_PRIVATE_KEY,
  jwtPublicKey: envVars.JWT_PUBLIC_KEY,
  googleClientId: envVars.GOOGLE_CLIENT_ID,
  googleClientSecret: envVars.GOOGLE_CLIENT_SECRET,
  facebookClientId: envVars.FACEBOOK_CLIENT_ID,
  facebookClientSecret: envVars.FACEBOOK_CLIENT_SECRET,
  githubClientId: envVars.GITHUB_CLIENT_ID,
  githubClientSecret: envVars.GITHUB_CLIENT_SECRET,
  corsAllowedOrigins: processedCorsOrigins,
  refreshTokenExpirationSeconds: envVars.REFRESH_TOKEN_EXPIRATION_SECONDS,
  logLevel: envVars.LOG_LEVEL,
  appName: envVars.APP_NAME,
  mongoUri: envVars.MONGO_URI,
  postgresUri: envVars.POSTGRES_URI,
  userStoreType: envVars.USER_STORE_TYPE,
  // refreshTokenCookieName, refreshTokenCookieMaxAge are already correctly assigned from envVars
  // Ensure the value is one of the specific strings Express expects for res.cookie's sameSite
  refreshTokenCookieSameSite: envVars.REFRESH_TOKEN_COOKIE_SAMESITE.toLowerCase() === 'strict' ? 'Strict' :
                             envVars.REFRESH_TOKEN_COOKIE_SAMESITE.toLowerCase() === 'lax' ? 'Lax' :
                             envVars.REFRESH_TOKEN_COOKIE_SAMESITE.toLowerCase() === 'none' ? 'None' : 'Lax', // Default to Lax
  oauthProviders: [
    {
      name: 'google',
      strategyModulePath: '../auth/strategies/googleStrategy',
      options: {
        clientID: envVars.GOOGLE_CLIENT_ID,
        clientSecret: envVars.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
        scope: ['profile', 'email'],
        authorizationURL: envVars.GOOGLE_AUTHORIZATION_URL,
        tokenURL: envVars.GOOGLE_TOKEN_URL,
        userProfileURL: envVars.GOOGLE_USERINFO_URL,
      },
      isEnabled: !!(envVars.GOOGLE_CLIENT_ID && envVars.GOOGLE_CLIENT_SECRET),
      authPath: '/auth/google',
      callbackPath: '/auth/google/callback'
    },
    {
      name: 'facebook',
      strategyModulePath: '../auth/strategies/facebookStrategy',
      options: {
        clientID: envVars.FACEBOOK_CLIENT_ID,
        clientSecret: envVars.FACEBOOK_CLIENT_SECRET,
        callbackURL: '/auth/facebook/callback',
        scope: ['email', 'public_profile'],
        profileFields: ['id', 'displayName', 'emails', 'photos'],
        authorizationURL: envVars.FACEBOOK_AUTHORIZATION_URL,
        tokenURL: envVars.FACEBOOK_TOKEN_URL,
        profileURL: envVars.FACEBOOK_USER_PROFILE_URL,
      },
      isEnabled: !!(envVars.FACEBOOK_CLIENT_ID && envVars.FACEBOOK_CLIENT_SECRET),
      authPath: '/auth/facebook',
      callbackPath: '/auth/facebook/callback'
    },
    {
      name: 'github',
      strategyModulePath: '../auth/strategies/githubStrategy',
      options: {
        clientID: envVars.GITHUB_CLIENT_ID,
        clientSecret: envVars.GITHUB_CLIENT_SECRET,
        callbackURL: '/auth/github/callback',
        scope: ['user:email', 'read:user'],
        authorizationURL: envVars.GITHUB_AUTHORIZATION_URL,
        tokenURL: envVars.GITHUB_TOKEN_URL,
        userProfileURL: envVars.GITHUB_USER_PROFILE_URL,
        customHeaders: { 'User-Agent': envVars.APP_NAME }
      },
      isEnabled: !!(envVars.GITHUB_CLIENT_ID && envVars.GITHUB_CLIENT_SECRET),
      authPath: '/auth/github',
      callbackPath: '/auth/github/callback'
    },
  ].filter(p => p.isEnabled),
};

/**
 * Application configuration object, validated and processed.
 * @type {Config}
 */
export default config;
