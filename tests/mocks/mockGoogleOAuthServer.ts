// tests/mocks/mockGoogleOAuthServer.ts
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken'; // For id_token generation
import http from 'http'; // For http.Server type

const app: Application = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

interface StoredCode {
  userId: string | number; // Allow number for GitHub IDs if structure is reused
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
}
interface StoredAccessToken {
  userId: string | number;
  clientId: string;
  scope: string;
}

const codes: Map<string, StoredCode> = new Map();
const accessTokens: Map<string, StoredAccessToken> = new Map();

// Mock User type, can be expanded or imported from a shared test types file
interface MockUser {
  id: string;
  sub: string;
  email: string;
  name: string;
  displayName: string;
  picture: string;
  email_verified: boolean;
  emails: Array<{ value: string; verified?: boolean }>;
  photos: Array<{ value: string }>;
  _json?: any; // Raw JSON from provider
}


const MOCK_GOOGLE_USER: MockUser = {
  id: 'mock-google-id-12345',
  sub: 'mock-google-id-12345',
  email: 'mock.google.user@example.com',
  name: 'Mock Google User',
  displayName: 'Mock Google User',
  picture: 'https://example.com/mock-google-avatar.jpg',
  email_verified: true,
  emails: [{ value: 'mock.google.user@example.com', verified: true }],
  photos: [{ value: 'https://example.com/mock-google-avatar.jpg' }],
};

app.get('/o/oauth2/v2/auth', (req: Request, res: Response) => {
  const { client_id, redirect_uri, scope, response_type, state } = req.query as Record<string, string>;

  if (response_type !== 'code') {
    return res.status(400).send('Invalid response_type. Only "code" is supported.');
  }
  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }

  const simulated_approval = req.query.simulated_approval !== 'false';

  if (simulated_approval) {
    const authCode = `google_auth_code_${Date.now()}`;
    codes.set(authCode, { userId: MOCK_GOOGLE_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  }
});

app.post('/oauth2/v4/token', (req: Request, res: Response) => {
  const { client_id, client_secret, code, redirect_uri, grant_type } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid grant_type.' });
  }

  const storedCodeData = codes.get(code);
  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code);
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code or params.' });
  }

  codes.delete(code);

  const accessToken = `mock_google_access_token_${Date.now()}`;
  const idTokenPayload = {
      iss: 'https://accounts.google.com',
      aud: client_id,
      sub: storedCodeData.userId.toString(), // Ensure sub is string
      email: MOCK_GOOGLE_USER.email,
      email_verified: MOCK_GOOGLE_USER.email_verified,
      name: MOCK_GOOGLE_USER.name,
      picture: MOCK_GOOGLE_USER.picture,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const idToken = jwt.sign(idTokenPayload, 'mock-id-token-secret');

  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  res.json({
    access_token: accessToken,
    id_token: idToken,
    expires_in: 3599,
    token_type: 'Bearer',
    scope: storedCodeData.scope,
  });
});

app.get('/oauth2/v3/userinfo', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized', error_description: 'Missing Authorization.' });
    }
    const token = authHeader.split(' ')[1];
    const storedTokenData = accessTokens.get(token);

    if (!storedTokenData || storedTokenData.userId !== MOCK_GOOGLE_USER.id) {
        return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid token.' });
    }

    res.json({
        sub: MOCK_GOOGLE_USER.sub,
        name: MOCK_GOOGLE_USER.name,
        given_name: MOCK_GOOGLE_USER.name.split(' ')[0],
        family_name: MOCK_GOOGLE_USER.name.split(' ').slice(1).join(' '),
        picture: MOCK_GOOGLE_USER.picture,
        email: MOCK_GOOGLE_USER.email,
        email_verified: MOCK_GOOGLE_USER.email_verified,
        locale: 'en'
    });
});

let serverInstance: http.Server | null = null;

const start = (port: number = 0): Promise<http.Server> => {
  return new Promise((resolve, reject) => {
    if (serverInstance && serverInstance.listening) {
      return resolve(serverInstance);
    }
    serverInstance = app.listen(port, (err?: Error) => { // Add optional err for listen callback
      if (err) return reject(err);
      resolve(serverInstance as http.Server); // Ensure it's not null here
    });
  });
};

const stop = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err?: Error) => { // Add optional err for close callback
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

export { app, start, stop, MOCK_GOOGLE_USER, codes, accessTokens };
