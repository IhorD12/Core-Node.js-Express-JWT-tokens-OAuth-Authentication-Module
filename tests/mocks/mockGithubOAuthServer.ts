// tests/mocks/mockGithubOAuthServer.ts
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import http from 'http'; // For http.Server type

const app: Application = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

interface StoredCode {
  userId: string | number;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}
interface StoredAccessToken {
  userId: string | number;
  clientId: string;
  scope?: string;
}

const codes: Map<string, StoredCode> = new Map();
const accessTokens: Map<string, StoredAccessToken> = new Map();

// Re-using MockUser type structure, ensure consistency or define a shared one
interface MockUser {
  id: number; // GitHub ID is number
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
  html_url?: string;
  displayName?: string; // For Passport profile mapping
  username?: string;    // For Passport profile mapping
  profileUrl?: string;  // For Passport profile mapping
  photos?: Array<{ value: string }>;
  emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
  _json?: any;
}

const MOCK_GITHUB_USER: MockUser = {
  id: 7654321,
  login: 'mockgithubuser',
  name: 'Mock GitHub User',
  email: 'mock.github.user@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/7654321?v=4',
  html_url: 'https://github.com/mockgithubuser',
  displayName: 'Mock GitHub User',
  username: 'mockgithubuser',
  profileUrl: 'https://github.com/mockgithubuser',
  photos: [{ value: 'https://avatars.githubusercontent.com/u/7654321?v=4' }],
  emails: [
    { value: 'secondary.email@example.com', primary: false, verified: true },
    { value: 'mock.github.user@example.com', primary: true, verified: true }
  ],
  _json: {
    id: 7654321,
    login: 'mockgithubuser',
    name: 'Mock GitHub User',
    email: 'mock.github.user@example.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/7654321?v=4',
    html_url: 'https://github.com/mockgithubuser',
  }
};

app.get('/login/oauth/authorize', (req: Request, res: Response) => {
  const { client_id, redirect_uri, scope, state } = req.query as Record<string, string>;

  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }

  const simulated_approval = req.query.simulated_approval !== 'false';

  if (simulated_approval) {
    const authCode = `github_auth_code_${Date.now()}`;
    codes.set(authCode, { userId: MOCK_GITHUB_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_description', 'The user has denied access.');
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  }
});

app.post('/login/oauth/access_token', (req: Request, res: Response) => {
  const { client_id, client_secret, code, redirect_uri } = req.body;

  const storedCodeData = codes.get(code as string);

  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code as string);
    return res.status(400).json({ error: 'bad_verification_code', error_description: 'Code is incorrect or expired.' });
  }

  codes.delete(code as string);

  const accessToken = `mock_github_access_token_${Date.now()}`;
  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  res.json({
    access_token: accessToken,
    scope: storedCodeData.scope,
    token_type: 'bearer'
  });
});

app.get('/user', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || (!authHeader.toLowerCase().startsWith('token ') && !authHeader.toLowerCase().startsWith('bearer '))) {
    return res.status(401).json({ message: 'Requires authentication' });
  }
  const token = authHeader.split(' ')[1];
  const storedTokenData = accessTokens.get(token);

  if (!storedTokenData || storedTokenData.userId !== MOCK_GITHUB_USER.id) {
    return res.status(401).json({ message: 'Bad credentials' });
  }
  res.json(MOCK_GITHUB_USER._json);
});

app.get('/user/emails', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || (!authHeader.toLowerCase().startsWith('token ') && !authHeader.toLowerCase().startsWith('bearer '))) {
        return res.status(401).json({ message: 'Requires authentication' });
    }
    const token = authHeader.split(' ')[1];
    const storedTokenData = accessTokens.get(token);

    if (!storedTokenData || storedTokenData.userId !== MOCK_GITHUB_USER.id) {
        return res.status(401).json({ message: 'Bad credentials' });
    }

    if (storedTokenData.scope && (storedTokenData.scope.includes('user:email') || storedTokenData.scope.includes('user'))) {
        res.json(MOCK_GITHUB_USER.emails);
    } else {
        res.status(403).json({ message: 'Scope user:email not granted.'});
    }
});

let serverInstance: http.Server | null = null;

const start = (port: number = 0): Promise<http.Server> => {
  return new Promise((resolve, reject) => {
    if (serverInstance && serverInstance.listening) {
      return resolve(serverInstance);
    }
    serverInstance = app.listen(port, (err?: Error) => {
      if (err) return reject(err);
      resolve(serverInstance as http.Server);
    });
  });
};

const stop = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err?: Error) => {
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

export { app, start, stop, MOCK_GITHUB_USER, codes, accessTokens };
