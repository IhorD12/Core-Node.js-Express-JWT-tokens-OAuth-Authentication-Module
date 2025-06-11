// server.js
const app = require('./app');
const { port, nodeEnv } = require('../config');

/**
 * @fileoverview Server startup script.
 * Imports the Express app and starts listening on the configured port.
 */

const PORT = port || 3000;

// Start the server only if not in 'test' environment
// Test environment will typically start and stop the server programmatically.
if (nodeEnv !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running in ${nodeEnv} mode on http://localhost:${PORT}`);
    console.log('JWT_SECRET loaded:', !!require('./config').jwtSecret ? 'Yes' : 'No - WARNING!');
    console.log(
      'Google Client ID loaded:',
      !!require('./config').googleClientId ? 'Yes' : 'No - WARNING (Google Auth will fail)!'
    );
    console.log(
      'Facebook Client ID loaded:',
      !!require('./config').facebookClientId ? 'Yes' : 'No - WARNING (Facebook Auth will fail)!'
    );
  });
} else {
  console.log('Server not started in test mode. App is exported.');
}
