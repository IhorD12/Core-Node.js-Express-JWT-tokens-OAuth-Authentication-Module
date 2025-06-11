// tests/mocks/mockGithubOAuthServer.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const codes = new Map(); // { code: { userId, clientId, redirectUri, scope, state } }
const accessTokens = new Map(); // { token: { userId, clientId, scope } }

const MOCK_GITHUB_USER = {
  id: 7654321, // GitHub IDs are numbers
  login: 'mockgithubuser', // Corresponds to username
  name: 'Mock GitHub User', // Can be null if not set by user
  email: 'mock.github.user@example.com', // Primary public email or from user:email scope
  avatar_url: 'https://avatars.githubusercontent.com/u/7654321?v=4',
  html_url: 'https://github.com/mockgithubuser',
  // For Passport profile mapping to standard fields
  displayName: 'Mock GitHub User', // Use name or login
  username: 'mockgithubuser',
  profileUrl: 'https://github.com/mockgithubuser',
  photos: [{ value: 'https://avatars.githubusercontent.com/u/7654321?v=4' }],
  emails: [ // GitHub /user/emails endpoint returns an array like this
    { value: 'secondary.email@example.com', primary: false, verified: true },
    { value: 'mock.github.user@example.com', primary: true, verified: true }
  ],
  _json: { // Raw JSON often stored by Passport from /user endpoint
    id: 7654321,
    login: 'mockgithubuser',
    name: 'Mock GitHub User',
    email: 'mock.github.user@example.com', // Public email from /user if available
    avatar_url: 'https://avatars.githubusercontent.com/u/7654321?v=4',
    html_url: 'https://github.com/mockgithubuser',
  }
};

// GitHub's Authorization Endpoint
// GET /login/oauth/authorize
app.get('/login/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, scope, state } = req.query; // allow_signup is also a param

  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }
  // response_type is implicitly 'code' for GitHub's standard web flow

  const simulated_approval = req.query.simulated_approval !== 'false';

  if (simulated_approval) {
    const authCode = `github_auth_code_${Date.now()}`;
    codes.set(authCode, { userId: MOCK_GITHUB_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_description', 'The user has denied access.');
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(redirectUrl.toString());
  }
});

// GitHub's Token Endpoint
// POST /login/oauth/access_token
app.post('/login/oauth/access_token', (req, res) => {
  const { client_id, client_secret, code, redirect_uri } = req.body; // state is optional here

  const storedCodeData = codes.get(code);

  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code);
    return res.status(400).json({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' });
  }

  codes.delete(code); // Code is single-use

  const accessToken = `mock_github_access_token_${Date.now()}`;
  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  // GitHub's token response is typically form-urlencoded: access_token=TOKEN&scope=SCOPE&token_type=bearer
  // For mock simplicity, returning JSON is often fine as many clients/libraries parse it.
  // If passport-github2 strictly expects form-urlencoded, this might need adjustment.
  // Most modern OAuth libraries can handle JSON responses for token endpoints.
  res.json({
    access_token: accessToken,
    scope: storedCodeData.scope,
    token_type: 'bearer'
  });
});

// GitHub's API User Endpoint
// GET /user
app.get('/user', (req, res) => {
  const authHeader = req.headers.authorization; // e.g., "token OAUTH-TOKEN" or "bearer OAUTH-TOKEN"
  if (!authHeader || (!authHeader.toLowerCase().startsWith('token ') && !authHeader.toLowerCase().startsWith('bearer '))) {
    return res.status(401).json({ message: 'Requires authentication' });
  }
  const token = authHeader.split(' ')[1];
  const storedTokenData = accessTokens.get(token);

  if (!storedTokenData || storedTokenData.userId !== MOCK_GITHUB_USER.id) {
    return res.status(401).json({ message: 'Bad credentials' });
  }

  // Return a structure similar to GitHub's /user response
  // MOCK_GITHUB_USER._json is a good representation.
  res.json(MOCK_GITHUB_USER._json);
});

// GitHub's API User Emails Endpoint (if user:email scope is granted)
// GET /user/emails
app.get('/user/emails', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.toLowerCase().startsWith('token ') && !authHeader.toLowerCase().startsWith('bearer '))) {
        return res.status(401).json({ message: 'Requires authentication' });
    }
    const token = authHeader.split(' ')[1];
    const storedTokenData = accessTokens.get(token);

    if (!storedTokenData || storedTokenData.userId !== MOCK_GITHUB_USER.id) {
        return res.status(401).json({ message: 'Bad credentials' });
    }

    // Check if 'user:email' scope was granted (simplified check)
    if (storedTokenData.scope && (storedTokenData.scope.includes('user:email') || storedTokenData.scope.includes('user'))) {
        res.json(MOCK_GITHUB_USER.emails); // Return the array of email objects
    } else {
        // If scope is insufficient, GitHub might return an empty array or profile without email.
        // For testing, we can simulate this by returning empty or an error.
        res.status(403).json({ message: 'user:email scope not granted for this token or no public email.'});
    }
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

module.exports = { app, start, stop, MOCK_GITHUB_USER, codes, accessTokens };

// if (require.main === module) {
//   start(3007).then(instance => {
//     console.log(`Mock GitHub OAuth server running on http://localhost:${instance.address().port}`);
//   });
// }
