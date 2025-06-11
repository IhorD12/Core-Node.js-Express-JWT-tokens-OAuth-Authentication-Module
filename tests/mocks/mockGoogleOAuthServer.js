// tests/mocks/mockGoogleOAuthServer.js
const express = require('express');
const bodyParser = require('body-parser'); // To parse POST request bodies
const jwt = require('jsonwebtoken'); // For id_token generation

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// In-memory store for auth codes and tokens
const codes = new Map(); // store { code: { userId, clientId, redirectUri, scope, state } }
const accessTokens = new Map(); // store { token: { userId, clientId, scope } }

const MOCK_GOOGLE_USER = {
  id: 'mock-google-id-12345', // This is the providerId
  sub: 'mock-google-id-12345', // for id_token and userinfo
  email: 'mock.google.user@example.com',
  name: 'Mock Google User',
  displayName: 'Mock Google User', // Passport often uses displayName
  picture: 'https://example.com/mock-google-avatar.jpg',
  email_verified: true,
  // For Passport profile structure, often an emails array
  emails: [{ value: 'mock.google.user@example.com', verified: true }],
  // For Passport profile structure, often a photos array
  photos: [{ value: 'https://example.com/mock-google-avatar.jpg' }],
};

// Google's Authorization Endpoint (simplified)
// GET /o/oauth2/v2/auth
app.get('/o/oauth2/v2/auth', (req, res) => {
  const { client_id, redirect_uri, scope, response_type, state } = req.query;

  if (response_type !== 'code') {
    return res.status(400).send('Invalid response_type. Only "code" is supported.');
  }
  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }

  // Simulate user approval or denial (can be controlled by test via a query param or header)
  const simulated_approval = req.query.simulated_approval !== 'false'; // Default to true

  if (simulated_approval) {
    const authCode = `google_auth_code_${Date.now()}`;
    // Store the MOCK_GOOGLE_USER.id as userId, which matches the 'sub' claim
    codes.set(authCode, { userId: MOCK_GOOGLE_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  }
});

// Google's Token Endpoint (simplified)
// POST /oauth2/v4/token
app.post('/oauth2/v4/token', (req, res) => {
  const { client_id, client_secret, code, redirect_uri, grant_type } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid grant_type. Only "authorization_code" is supported.' });
  }

  const storedCodeData = codes.get(code);
  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code); // Invalidate used or mismatched code
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code, or mismatched redirect_uri/client_id.' });
  }

  codes.delete(code); // Code is single-use

  const accessToken = `mock_google_access_token_${Date.now()}`;
  // The id_token's 'sub' should match the user's Google ID.
  const idTokenPayload = {
      iss: 'https://accounts.google.com', // Mock issuer
      aud: client_id,
      sub: storedCodeData.userId, // This is MOCK_GOOGLE_USER.id
      email: MOCK_GOOGLE_USER.email,
      email_verified: MOCK_GOOGLE_USER.email_verified,
      name: MOCK_GOOGLE_USER.name,
      picture: MOCK_GOOGLE_USER.picture,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const idToken = jwt.sign(idTokenPayload, 'mock-id-token-secret'); // Secret for mock server's ID token

  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  res.json({
    access_token: accessToken,
    id_token: idToken,
    expires_in: 3599,
    token_type: 'Bearer',
    scope: storedCodeData.scope,
    // refresh_token: `mock_google_refresh_token_${Date.now()}` // Optional
  });
});

// Google's UserInfo Endpoint (simplified)
// GET /oauth2/v3/userinfo - typically used by passport-google-oauth20 if strategy configured to fetch profile
app.get('/oauth2/v3/userinfo', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized', error_description: 'Missing or invalid Authorization header.' });
    }
    const token = authHeader.split(' ')[1];
    const storedTokenData = accessTokens.get(token);

    if (!storedTokenData || storedTokenData.userId !== MOCK_GOOGLE_USER.id) { // Check token association
        return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid or expired access token.' });
    }

    // Return data consistent with MOCK_GOOGLE_USER and id_token payload
    // Passport Google strategy often maps these fields to its standard profile object.
    res.json({
        sub: MOCK_GOOGLE_USER.sub,
        name: MOCK_GOOGLE_USER.name,
        given_name: MOCK_GOOGLE_USER.name.split(' ')[0], // Simplified
        family_name: MOCK_GOOGLE_USER.name.split(' ').slice(1).join(' '), // Simplified
        picture: MOCK_GOOGLE_USER.picture,
        email: MOCK_GOOGLE_USER.email,
        email_verified: MOCK_GOOGLE_USER.email_verified,
        locale: 'en'
        // The actual Google userinfo response can be more complex. This is a minimal mock.
    });
});


let serverInstance;
const start = (port = 0) => {
  return new Promise((resolve, reject) => {
    if (serverInstance && serverInstance.listening) {
      // console.log('Mock Google OAuth server is already running.');
      return resolve(serverInstance);
    }
    serverInstance = app.listen(port, (err) => {
      if (err) return reject(err);
      // const address = serverInstance.address();
      // console.log(`Mock Google OAuth server listening on port ${address ? address.port : 'unknown'}`);
      resolve(serverInstance);
    });
  });
};

const stop = () => {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err) => {
        if (err) return reject(err);
        // console.log('Mock Google OAuth server stopped.');
        codes.clear();
        accessTokens.clear();
        serverInstance = null; // Clear instance
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = { app, start, stop, MOCK_GOOGLE_USER, codes, accessTokens };

// Example to run standalone for quick testing of the mock server itself:
// if (require.main === module) {
//   start(3005).then(instance => {
//     console.log(`Mock Google OAuth server running for standalone test on http://localhost:${instance.address().port}`);
//   });
// }
