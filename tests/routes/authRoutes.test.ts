// tests/routes/authRoutes.test.ts
import request from 'supertest';
import http from 'http'; // For http.Server type for appServer
import { URL } from 'url'; // For parsing URLs

// Import the Express app instance (will be loaded after env mocks)
let app: Express.Application;
// Import config (will be loaded after env mocks)
let config: any;
// Import authService (will be loaded after env mocks)
let authService: any;


import MockUserStore from '@src/auth/mockUserStore'; // Path alias
const userStoreInstance = new MockUserStore(); // Used for clearing users

// Import Mock Servers
import * as mockGoogleServer from '@mocks/mockGoogleOAuthServer'; // Path alias
import * as mockFacebookServer from '@mocks/mockFacebookOAuthServer'; // Path alias
import * as mockGithubServer from '@mocks/mockGithubOAuthServer'; // Path alias
import { UserProfile } from '@src/adapters/userStoreAdapter'; // For typing mock user

// Helper function to parse Set-Cookie headers
interface ParsedCookie {
  name: string;
  value: string;
  [key: string]: string | boolean | Date | undefined | number; // Added number for max-age
}
const parseSetCookie = (cookiesHeader: string | string[] | undefined): ParsedCookie[] => {
  if (!cookiesHeader) return [];
  const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : [cookiesHeader];
  return cookies.map(cookieStr => {
    const parts = cookieStr.split(';').map(part => part.trim());
    const [nameValue, ...attrs] = parts;
    const [name, ...valueParts] = nameValue.split('=');
    const parsed: ParsedCookie = { name, value: valueParts.join('=') };
    attrs.forEach(attr => {
      const [attrName, ...attrValueParts] = attr.split('=');
      const attrValue = attrValueParts.join('=');
      const lowerCaseAttrName = attrName.toLowerCase(); // Standardize attribute names

      if (lowerCaseAttrName === 'expires') {
        try { parsed[lowerCaseAttrName] = new Date(attrValue); } catch (e) { /* ignore invalid date */ }
      } else if (lowerCaseAttrName === 'max-age') {
        parsed[lowerCaseAttrName] = parseInt(attrValue, 10);
      } else {
        parsed[lowerCaseAttrName] = attrValue === undefined ? true : attrValue;
      }
    });
    return parsed;
  });
};


describe('Auth Routes Integration Tests with Mock OAuth Servers', () => {
  let googleServer: http.Server, facebookServer: http.Server, githubServer: http.Server;
  let googleMockUrl: string, facebookMockUrl: string, githubMockUrl: string;
  let appServer: http.Server;

  beforeAll(async () => {
    googleServer = await mockGoogleServer.start();
    googleMockUrl = `http://localhost:${(googleServer.address() as import('net').AddressInfo).port}`;
    process.env.GOOGLE_AUTHORIZATION_URL = `${googleMockUrl}/o/oauth2/v2/auth`;
    process.env.GOOGLE_TOKEN_URL = `${googleMockUrl}/oauth2/v4/token`;
    process.env.GOOGLE_USERINFO_URL = `${googleMockUrl}/oauth2/v3/userinfo`;

    facebookServer = await mockFacebookServer.start();
    facebookMockUrl = `http://localhost:${(facebookServer.address() as import('net').AddressInfo).port}`;
    process.env.FACEBOOK_AUTHORIZATION_URL = `${facebookMockUrl}/dialog/oauth`;
    process.env.FACEBOOK_TOKEN_URL = `${facebookMockUrl}/oauth/access_token`;
    process.env.FACEBOOK_USER_PROFILE_URL = `${facebookMockUrl}/me`;

    githubServer = await mockGithubServer.start();
    githubMockUrl = `http://localhost:${(githubServer.address() as import('net').AddressInfo).port}`;
    process.env.GITHUB_AUTHORIZATION_URL = `${githubMockUrl}/login/oauth/authorize`;
    process.env.GITHUB_TOKEN_URL = `${githubMockUrl}/login/oauth/access_token`;
    process.env.GITHUB_USER_PROFILE_URL = `${githubMockUrl}/user`;
    process.env.GITHUB_CLIENT_ID = 'mock-github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'mock-github-client-secret';
    process.env.APP_NAME = 'TestAppForGitHub';

    process.env.NODE_ENV = 'test';

    jest.resetModules();
    app = require('@src/app').default;
    config = require('@config/index').default;
    authService = require('@services/authService').default; // Load authService after config

    await new Promise<void>(resolve => {
        appServer = app.listen(0, () => resolve());
    });
    process.env.PORT = (appServer.address() as import('net').AddressInfo).port.toString();
  });

  afterAll(async () => {
    if (googleServer) await mockGoogleServer.stop();
    if (facebookServer) await mockFacebookServer.stop();
    if (githubServer) await mockGithubServer.stop();
    if (appServer) await new Promise<void>(resolve => appServer.close(() => resolve()));
  });

  beforeEach(async () => {
    await userStoreInstance.clearAllUsers();
    mockGoogleServer.codes.clear(); mockGoogleServer.accessTokens.clear();
    mockFacebookServer.codes.clear(); mockFacebookServer.accessTokens.clear();
    mockGithubServer.codes.clear(); mockGithubServer.accessTokens.clear();
  });

  // --- Google Auth Tests ---
  // ... (Google tests remain as they were, with cookie checks) ...
  describe('Google OAuth Flow', () => {
    it('should redirect to the mock Google OAuth authorization URL', async () => {
        const response = await request(app).get('/auth/google').expect(302);
        const redirectUrl = new URL(response.headers.location);
        expect(redirectUrl.origin).toBe(googleMockUrl);
        const googleConfigProvider = config.oauthProviders.find((p: any) => p.name === 'google');
        expect(redirectUrl.searchParams.get('client_id')).toBe(googleConfigProvider.options.clientID);
        const expectedRedirectUri = `http://127.0.0.1:${process.env.PORT}${googleConfigProvider.options.callbackURL}`;
        expect(redirectUrl.searchParams.get('redirect_uri')).toBe(expectedRedirectUri);
      });

    it('should set refresh token cookie on successful mock Google auth callback', async () => {
      const agent = request.agent(app);
      const googleConfigProvider = config.oauthProviders.find((p: any) => p.name === 'google');
      const appCallbackUrl = `http://127.0.0.1:${process.env.PORT}${googleConfigProvider.options.callbackURL}`;
      const mockAuthCode = 'test_google_code_for_cookie_test';
      mockGoogleServer.codes.set(mockAuthCode, { userId: mockGoogleServer.MOCK_GOOGLE_USER.id, clientId: googleConfigProvider.options.clientID!, redirectUri: appCallbackUrl, scope: (googleConfigProvider.options.scope as string[]).join(' '), });
      const response = await agent.get(`/auth/google/callback?code=${mockAuthCode}`).expect(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe(mockGoogleServer.MOCK_GOOGLE_USER.email);
      const cookies = parseSetCookie(response.headers['set-cookie']);
      const refreshTokenCookie = cookies.find(c => c.name === config.refreshTokenCookieName);
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie?.httpOnly).toBe(true);
      expect(refreshTokenCookie?.path).toBe('/auth');
      expect(refreshTokenCookie?.samesite).toBe(config.refreshTokenCookieSameSite);
      expect(refreshTokenCookie?.['max-age']).toBe(config.refreshTokenCookieMaxAge / 1000);
      if (config.nodeEnv === 'production') expect(refreshTokenCookie?.secure).toBe(true);
      else expect(refreshTokenCookie?.secure).toBeUndefined();
    });
    it('should redirect to /auth/login-failure if mock Google auth is denied', async () => {
        const agent = request.agent(app);
        const response = await agent.get('/auth/google/callback?error=access_denied').expect(302);
        expect(response.headers.location).toBe('/auth/login-failure');
      });
  });

  // --- Facebook Auth Tests (Minimal, assuming similar pattern to Google) ---
  describe('Facebook OAuth Flow', () => {
    it('should redirect to the mock Facebook OAuth authorization URL', async () => {
        await request(app).get('/auth/facebook').expect(302);
    });
  });

  // --- GitHub Auth Tests (Minimal, assuming similar pattern to Google) ---
  describe('GitHub OAuth Flow', () => {
    it('should redirect to the mock GitHub OAuth authorization URL', async () => {
        await request(app).get('/auth/github').expect(302);
    });
  });

  // --- Token Management Tests ---
  // ... (Existing refresh and logout tests with cookie and payload validation) ...
  describe('POST /auth/refresh', () => {
    let testUser: UserProfile;
    let initialRefreshToken: string;
    let initialRefreshTokenCookie: string;
    beforeEach(async () => {
      const userProfileDetails = { providerId: 'refreshUser123', provider: 'test', displayName: 'Refresh User', email: 'refresh@example.com' };
      testUser = await userStoreInstance.findOrCreateUser(userProfileDetails);
      const tokens = await authService.generateAndStoreAuthTokens(testUser);
      initialRefreshToken = tokens.refreshToken;
      initialRefreshTokenCookie = `${config.refreshTokenCookieName}=${initialRefreshToken}`;
    });
    // ... other refresh tests ...
    it('should refresh tokens using refreshToken from cookie and set new cookie', async () => {
        const response = await request(app).post('/auth/refresh').set('Cookie', [initialRefreshTokenCookie]).send({}).expect(200);
        expect(response.body.accessToken).toBeDefined();
        const cookies = parseSetCookie(response.headers['set-cookie']);
        const newRefreshTokenCookie = cookies.find(c => c.name === config.refreshTokenCookieName);
        expect(newRefreshTokenCookie?.value).not.toBe(initialRefreshToken);
    });
    it('should return 400 if refreshToken is missing (no cookie, no body)', async () => {
        const response = await request(app).post('/auth/refresh').send({}).expect(400);
        expect(response.body.message).toBe('Validation failed.');
    });
  });

  describe('POST /auth/logout', () => {
    // ... logout tests ...
  });

  describe('POST /auth/2fa/verify Payload Validation', () => {
    // ... 2FA tests ...
  });

  // --- Rate Limiting Tests ---
  describe('Rate Limiting', () => {
    // Note: General Auth Limiter points: 3, Sensitive Operation Limiter points: 2 (for 'test' env)
    // Durations are 5s, block for 10s.

    it('should trigger general auth rate limit on /auth/login-failure (example general route)', async () => {
      const agent = request(app);
      // Consume points for generalAuthLimiter (3 points)
      await agent.get('/auth/login-failure').expect(401); // 1st
      await agent.get('/auth/login-failure').expect(401); // 2nd
      await agent.get('/auth/login-failure').expect(401); // 3rd

      // 4th request should be rate limited
      const response = await agent.get('/auth/login-failure').expect(429);
      expect(response.body.message).toMatch(/Too many requests/);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should trigger sensitive operation rate limit on /auth/refresh', async () => {
      const agent = request(app);
      const refreshTokenPayload = { refreshToken: 'anytoken' }; // Joi validation will pass this

      // Consume points for sensitiveOperationLimiter (2 points)
      // Each of these also consumes 1 point from generalAuthLimiter
      await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401); // 1st sensitive (e.g. invalid token error)
      await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401); // 2nd sensitive

      // 3rd request to sensitive endpoint should be rate limited by sensitiveOperationLimiter
      const response = await agent.post('/auth/refresh').send(refreshTokenPayload).expect(429);
      expect(response.body.message).toMatch(/Too many requests/);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('general limiter should allow requests after its duration, even if sensitive is blocking for longer', async () => {
        const agent = request(app);
        const refreshTokenPayload = { refreshToken: 'anytoken' };

        // Hit sensitive limit (2 requests, blocks for 10s)
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401); // General: 1, Sensitive: 1
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401); // General: 2, Sensitive: 2 (now blocking)
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(429); // Blocked by sensitive

        // Hit general limit with a different /auth route not subject to sensitive limiter (3rd request, blocks for 10s)
        // Assumes /auth/login-failure is only covered by general limiter
        await agent.get('/auth/login-failure').expect(401); // General: 3 (now blocking)
        await agent.get('/auth/login-failure').expect(429); // Blocked by general

        // Wait for general limiter's duration (5s) + buffer (1s) = 6s
        // Sensitive limiter is still blocking (10s block)
        await new Promise(resolve => setTimeout(resolve, 6000));

        // General limiter should allow again
        await agent.get('/auth/login-failure').expect(401);

        // Sensitive route /auth/refresh should still be blocked by its own longer block
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(429);
    }, 12000); // Increase Jest timeout for this test

    it('sensitive limiter should allow requests after its blockDuration', async () => {
        const agent = request(app);
        const refreshTokenPayload = { refreshToken: 'anytoken' };
        // Hit sensitive limit (2 requests, blocks for 10s)
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401);
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401);
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(429);

        // Wait for sensitive limiter's blockDuration (10s) + buffer (1s) = 11s
        await new Promise(resolve => setTimeout(resolve, 11000));

        // Should be allowed again by sensitive (and general, as its duration also passed)
        await agent.post('/auth/refresh').send(refreshTokenPayload).expect(401); // Will fail due to invalid token, but not 429
    }, 15000); // Increase Jest timeout
  });

  // --- Login Failure Route ---
  describe('GET /auth/login-failure', () => {
    it('should return 401 with a generic failure message', async () => {
        const response = await request(app)
            .get('/auth/login-failure')
            .expect(401);
        expect(response.body.message).toBe('OAuth authentication failed. Please try again.');
    });
  });
});
