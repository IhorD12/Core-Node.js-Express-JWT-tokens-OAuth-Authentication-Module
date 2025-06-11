// tests/setup.ts

// This file is executed by Jest via `setupFilesAfterEnv` in jest.config.js.
// It's a good place for global test setup, but environment variables
// should be set as early as possible, ideally before Jest even starts
// or via Jest's `globals` configuration if they need to influence module loading.

// The environment variables set here are intended to be available when
// modules (like config/index.ts) are first imported by test files or by app code.

process.env.NODE_ENV = 'test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_jest_setup';

// Default OAuth ENV VARS to empty strings for 'test' mode.
// This allows Joi validation in config/index.ts to pass for optional OAuth credentials in 'test' mode.
// Specific test suites (like authRoutes.test.ts) will override these with mock server URLs
// and mock client IDs/secrets for the providers they are testing.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
process.env.GOOGLE_AUTHORIZATION_URL = process.env.GOOGLE_AUTHORIZATION_URL || '';
process.env.GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || '';
process.env.GOOGLE_USERINFO_URL = process.env.GOOGLE_USERINFO_URL || '';

process.env.FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || '';
process.env.FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET || '';
process.env.FACEBOOK_AUTHORIZATION_URL = process.env.FACEBOOK_AUTHORIZATION_URL || '';
process.env.FACEBOOK_TOKEN_URL = process.env.FACEBOOK_TOKEN_URL || '';
process.env.FACEBOOK_USER_PROFILE_URL = process.env.FACEBOOK_USER_PROFILE_URL || '';

process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
process.env.GITHUB_AUTHORIZATION_URL = process.env.GITHUB_AUTHORIZATION_URL || '';
process.env.GITHUB_TOKEN_URL = process.env.GITHUB_TOKEN_URL || '';
process.env.GITHUB_USER_PROFILE_URL = process.env.GITHUB_USER_PROFILE_URL || '';

process.env.APP_NAME = process.env.APP_NAME || 'TestApp';

// Note: `dotenv` is NOT explicitly loaded here anymore.
// We rely on `config/index.ts` (imported by the app or tests) to load .env if present,
// and these `process.env` overrides will take precedence if set before `config/index.ts` is first imported.
// For Jest, `setupFilesAfterEnv` runs after the test environment is set up but before tests run.
// If `config/index.ts` is imported at the top level of a test file, it might load before these are fully effective
// for that initial load. `jest.resetModules()` in test suites that modify these further (like authRoutes.test.ts) is key.

// No global passport mock here. Test suites handle mocking locally if needed.
// e.g., authRoutes.test.ts used to mock passport.authenticate but now uses mock servers.
// e.g., middleware tests might mock specific passport functions.
console.log('Global test setup (tests/setup.ts): NODE_ENV set to test.');
