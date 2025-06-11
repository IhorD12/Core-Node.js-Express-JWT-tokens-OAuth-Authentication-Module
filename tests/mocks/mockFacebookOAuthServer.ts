// tests/mocks/mockFacebookOAuthServer.ts
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
  scope?: string; // Scope might be optional or handled differently by FB
  state?: string;
}
interface StoredAccessToken {
  userId: string | number;
  clientId: string;
  scope?: string;
}

const codes: Map<string, StoredCode> = new Map();
const accessTokens: Map<string, StoredAccessToken> = new Map();

interface MockFacebookUserPictureData {
    height: number;
    is_silhouette: boolean;
    url: string;
    width: number;
}
interface MockFacebookUserPicture {
    data: MockFacebookUserPictureData;
}
interface MockUser { // Re-usable mock user type structure
  id: string;
  name: string;
  email?: string | null; // Facebook email can be null
  picture?: MockFacebookUserPicture; // Facebook picture is an object
  displayName: string;
  emails: Array<{ value: string | null }>; // Ensure emails value can be null
  photos: Array<{ value: string }>;
  _json?: any;
}


const MOCK_FACEBOOK_USER: MockUser = {
  id: 'mock-facebook-id-67890',
  name: 'Mock Facebook User',
  email: 'mock.facebook.user@example.com',
  picture: {
    data: {
      height: 50,
      is_silhouette: false,
      url: 'https://example.com/mock-facebook-avatar.jpg',
      width: 50,
    },
  },
  displayName: 'Mock Facebook User',
  emails: [{ value: 'mock.facebook.user@example.com' }],
  photos: [{ value: 'https://example.com/mock-facebook-avatar.jpg' }],
};

app.get('/dialog/oauth', (req: Request, res: Response) => {
  const { client_id, redirect_uri, scope, response_type, state } = req.query as Record<string, string>;

  if (response_type !== 'code') {
    return res.status(400).send('Invalid response_type. Only "code" is supported for this mock.');
  }
  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri.');
  }

  const simulated_approval = req.query.simulated_approval !== 'false';

  if (simulated_approval) {
    const authCode = `fb_auth_code_${Date.now()}`;
    codes.set(authCode, { userId: MOCK_FACEBOOK_USER.id, clientId: client_id, redirectUri: redirect_uri, scope, state });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  } else {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_reason', 'user_denied');
    redirectUrl.searchParams.set('error_description', 'User denied access.');
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  }
});

app.post('/oauth/access_token', (req: Request, res: Response) => {
  const params = Object.keys(req.body).length > 0 ? req.body : req.query;
  const { client_id, client_secret, code, redirect_uri } = params;

  const storedCodeData = codes.get(code as string);

  if (!storedCodeData || storedCodeData.redirectUri !== redirect_uri || storedCodeData.clientId !== client_id) {
    codes.delete(code as string);
    return res.status(400).json({ error: { message: 'Invalid code or params.', type: 'OAuthException', code: 100 } });
  }

  codes.delete(code as string);

  const accessToken = `mock_fb_access_token_${Date.now()}`;
  accessTokens.set(accessToken, { userId: storedCodeData.userId, clientId: client_id, scope: storedCodeData.scope });

  res.json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
  });
});

app.get('/me', (req: Request, res: Response) => {
    let token = req.query.access_token as string | undefined;
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

    const fields = req.query.fields ? (req.query.fields as string).split(',') : ['id', 'name', 'email', 'picture'];
    const responseUser: Partial<MockUser> = {}; // Use Partial for constructing response

    if (fields.includes('id')) responseUser.id = MOCK_FACEBOOK_USER.id;
    if (fields.includes('name')) responseUser.name = MOCK_FACEBOOK_USER.name;
    if (fields.includes('email') && MOCK_FACEBOOK_USER.email) responseUser.email = MOCK_FACEBOOK_USER.email;
    if (fields.includes('picture') && MOCK_FACEBOOK_USER.picture) responseUser.picture = MOCK_FACEBOOK_USER.picture;

    res.json(responseUser);
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

export { app, start, stop, MOCK_FACEBOOK_USER, codes, accessTokens };
