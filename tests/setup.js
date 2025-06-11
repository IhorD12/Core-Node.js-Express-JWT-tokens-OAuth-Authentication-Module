// tests/setup.js

// Set a specific JWT_SECRET for tests if not already set, to ensure consistency
// This should ideally come from a .env.test file or be explicitly set.
// For now, ensure config/index.js can handle a default or test-specific secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_jest_coverage';
process.env.NODE_ENV = 'test'; // Crucial for app and server behavior during tests

// Ensure OAuth ENV VARS are undefined or empty for 'test' so conditional logic in Joi validation works
// This allows tests to run without real OAuth credentials.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
process.env.FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || '';
process.env.FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET || '';


// No global passport mock here, as individual test suites handle mocking if needed.
// For example, authRoutes.test.js mocks passport.authenticate locally.
// profileRoutes.test.js relies on the real JWT strategy.

// By not calling require('dotenv').config() here, we rely on config/index.js
// (which is loaded when app.js or other modules are imported by tests)
// to handle the .env loading. This avoids the 'Cannot find module dotenv'
// error if Jest has trouble resolving it directly from tests/setup.js.
// The environment variables set above will be available when config/index.js runs.
