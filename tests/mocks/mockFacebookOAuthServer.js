// tests/mocks/mockFacebookOAuthServer.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// In-memory store for auth codes and tokens
const codes = new Map(); // store { code: { userId, clientId, redirectUri, scope, state } }
const accessTokens = new Map(); // store { token: { userId, clientId, scope } }

const MOCK_FACEBOOK_USER = {
  id: 'mock-facebook-id-67890', // Facebook IDs are typically numeric strings
  name: 'Mock Facebook User',
  email: 'mock.facebook.user@example.com', // May or may not be available depending on scope/user settings
  picture: { // Facebook picture structure
    data: {
      height: 50,
      is_silhouette: false,
      url: 'https://example.com/mock-facebook-avatar.jpg',
      width: 50,
    },
  },
  // For Passport profile mapping
  displayName: 'Mock Facebook User',
  emails: [{ value: 'mock.facebook.user@example.com' }], // Passport expects this structure
  photos: [{ value: 'https://example.com/mock-facebook-avatar.jpg' }], // Passport expects this structure
};

// Facebook's Authorization Endpoint (simplified)
// GET /dialog/oauth
app.get('/dialog/oauth', (req, res) => {
  const { client_id, redirect_uri, scope, response_type, state } = req.query;

  if (response_type !== 'code') {
    // Facebook might handle this differently, but for mock, this is clear
    return res.status(400).send('Invalid response_type. Only "code" is supported for this mock.');
  }
  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }

  const simulated_approval = req.query.simulated_approval !== 'false'; // Default to true

  if (simulated_approval) {
    const authCode = `fb_auth_code_${Date.now()}`;
    codes.set(authCode, { userId: MOCK_FACEBOOK_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_reason', 'user_denied');
    redirectUrl.searchParams.set('error_description', 'User denied access.');
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  }
});

// Facebook's Token Endpoint (simplified)
// GET or POST /oauth/access_token (Facebook uses GET for server-side, but POST is also common for OAuth2)
// Let's stick to POST for consistency with Google mock and typical OAuth2, but Facebook often uses GET here.
// For a mock, either is fine as long as the test client matches.
app.post('/oauth/access_token', (req, res) => {
  // Facebook's token endpoint can accept GET or POST.
  // For POST, params are in body. For GET, in query.
  // This mock will check body first, then query for flexibility.
  const params = Object.keys(req.body).length > 0 ? req.body : req.query;
  const { client_id, client_secret, code, redirect_uri } = params;

  const storedCodeData = codes.get(code);

  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code);
    return res.status(400).json({ error: { message: 'Invalid authorization code, redirect_uri, or client_id.', type: 'OAuthException', code: 100 } });
  }

  codes.delete(code); // Code is single-use

  const accessToken = `mock_fb_access_token_${Date.now()}`;
  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  res.json({
    access_token: accessToken,
    token_type: 'bearer', // Facebook uses 'bearer'
    expires_in: 3600, // Example expiry
  });
});

// Facebook's Graph API User Info Endpoint (simplified)
// GET /me
app.get('/me', (req, res) => {
    // Facebook Graph API typically expects access_token as a query parameter or in Authorization header
    let token = req.query.access_token;
    const authHeader = req.headers.authorization;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(400).json({ error: { message: 'Missing access token.', type: 'OAuthException', code: 101 } });
    }

    const storedTokenData = accessTokens.get(token);

    if (!storedTokenData || storedTokenData.userId !== MOCK_FACEBOOK_USER.id) {
        return res.status(400).json({ error: { message: 'Invalid access token.', type: 'OAuthException', code: 190 } });
    }

    const fields = req.query.fields ? req.query.fields.split(',') : ['id', 'name', 'email', 'picture'];
    const responseUser = {};

    if (fields.includes('id')) responseUser.id = MOCK_FACEBOOK_USER.id;
    if (fields.includes('name')) responseUser.name = MOCK_FACEBOOK_USER.name;
    // Facebook may not return email if user hasn't granted permission or doesn't have a primary email.
    if (fields.includes('email') && MOCK_FACEBOOK_USER.email) responseUser.email = MOCK_FACEBOOK_USER.email;
    if (fields.includes('picture')) responseUser.picture = MOCK_FACEBOOK_USER.picture; // Facebook picture is an object

    res.json(responseUser);
});

let serverInstance;
const start = (port = 0) => {
  return new Promise((resolve, reject) => {
    if (serverInstance && serverInstance.listening) {
      return resolve(serverInstance);
    }
    serverInstance = app.listen(port, (err) => {
      if (err) return reject(err);
      resolve(serverInstance);
    });
  });
};

const stop = () => {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err) => {
        if (err) return reject(err);
        codes.clear();
        accessTokens.clear();
        serverInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = { app, start, stop, MOCK_FACEBOOK_USER, codes, accessTokens };

// To run this standalone for testing:
// if (require.main === module) {
//   start(3006).then(instance => {
//     console.log(`Mock Facebook OAuth server running on http://localhost:${instance.address().port}`);
//   });
// }
