// tests/setup.js
const dotenv = require('dotenv');
dotenv.config({ path: '.env' }); // Ensure .env is loaded for tests

// Set a specific JWT_SECRET for tests if not already set, to ensure consistency
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_jest';
process.env.NODE_ENV = 'test'; // Crucial for app and server not to auto-start listener

// No global passport mock here.
// Tests requiring passport mocks (like authRoutes.test.js for OAuth)
// should implement them locally.
// Tests for JWT strategy (like profileRoutes.test.js)
// will rely on the actual JWT strategy configured in app.js.
