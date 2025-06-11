// tests/routes/authRoutes.test.js
const request = require('supertest');

const MockUserStore = require('../../src/auth/mockUserStore');
const userStoreInstance = new MockUserStore(); // Used for clearing users

// Import Mock Servers
const mockGoogleServer = require('../mocks/mockGoogleOAuthServer');
const mockFacebookServer = require('../mocks/mockFacebookOAuthServer');
const mockGithubServer = require('../mocks/mockGithubOAuthServer'); // Import GitHub mock server

describe('Auth Routes Integration Tests with Mock OAuth Servers', () => {
  let googleServer, facebookServer, githubServer; // Instances of the mock servers (http.Server)
  let googleMockUrl, facebookMockUrl, githubMockUrl;
  let app; // Will be loaded after env vars are set
  let config; // Will be loaded after env vars are set
  let appServer; // To hold the instance of our main app server for getting its port

  beforeAll(async () => {
    // Start Google Mock Server
    googleServer = await mockGoogleServer.start();
    googleMockUrl = `http://localhost:${googleServer.address().port}`;
    process.env.GOOGLE_AUTHORIZATION_URL = `${googleMockUrl}/o/oauth2/v2/auth`;
    process.env.GOOGLE_TOKEN_URL = `${googleMockUrl}/oauth2/v4/token`;
    process.env.GOOGLE_USERINFO_URL = `${googleMockUrl}/oauth2/v3/userinfo`;

    // Start Facebook Mock Server
    facebookServer = await mockFacebookServer.start();
    facebookMockUrl = `http://localhost:${facebookServer.address().port}`;
    process.env.FACEBOOK_AUTHORIZATION_URL = `${facebookMockUrl}/dialog/oauth`;
    process.env.FACEBOOK_TOKEN_URL = `${facebookMockUrl}/oauth/access_token`;
    process.env.FACEBOOK_USER_PROFILE_URL = `${facebookMockUrl}/me`;

    // Start GitHub Mock Server
    githubServer = await mockGithubServer.start();
    githubMockUrl = `http://localhost:${githubServer.address().port}`;
    process.env.GITHUB_AUTHORIZATION_URL = `${githubMockUrl}/login/oauth/authorize`;
    process.env.GITHUB_TOKEN_URL = `${githubMockUrl}/login/oauth/access_token`;
    process.env.GITHUB_USER_PROFILE_URL = `${githubMockUrl}/user`;
    // Ensure GitHub provider is enabled for tests
    process.env.GITHUB_CLIENT_ID = 'mock-github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'mock-github-client-secret';
    process.env.APP_NAME = 'TestAppForGitHub'; // For User-Agent

    process.env.NODE_ENV = 'test';

    // Reset modules to ensure app and config load new env vars
    jest.resetModules();
    app = require('../../src/app');
    config = require('../../config');

    // Start the main app on a dynamic port to get its actual address for callback URLs
    await new Promise(resolve => {
        appServer = app.listen(0, resolve); // Listen on port 0 for random available port
    });
    process.env.PORT = appServer.address().port.toString(); // Store the dynamic port
  });

  afterAll(async () => {
    if (googleServer) await mockGoogleServer.stop();
    if (facebookServer) await mockFacebookServer.stop();
    if (githubServer) await mockGithubServer.stop();
    if (appServer) await new Promise(resolve => appServer.close(resolve));
  });

  beforeEach(async () => {
    await userStoreInstance.clearAllUsers();
    // Clear mock server states if they persist data across tests (current mocks clear on stop)
    mockGoogleServer.codes.clear(); mockGoogleServer.accessTokens.clear();
    mockFacebookServer.codes.clear(); mockFacebookServer.accessTokens.clear();
    mockGithubServer.codes.clear(); mockGithubServer.accessTokens.clear();
  });

  // --- Google Auth Tests ---
  describe('Google OAuth Flow', () => {
    it('should redirect to the mock Google OAuth authorization URL', async () => {
      const response = await request(app).get('/auth/google').expect(302);
      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(googleMockUrl);
      expect(redirectUrl.pathname).toBe('/o/oauth2/v2/auth');
      const googleConfig = config.oauthProviders.find(p => p.name === 'google');
      expect(redirectUrl.searchParams.get('client_id')).toBe(googleConfig.options.clientID);
      const expectedRedirectUri = `http://127.0.0.1:${appServer.address().port}${googleConfig.options.callbackURL}`;
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(expectedRedirectUri);
    });

    it('should return tokens and user info on successful mock Google auth callback', async () => {
      const agent = request.agent(app);
      const googleConfig = config.oauthProviders.find(p => p.name === 'google');
      const appCallbackUrl = `http://127.0.0.1:${appServer.address().port}${googleConfig.options.callbackURL}`;
      const mockAuthCode = 'test_google_code_for_callback';

      mockGoogleServer.codes.set(mockAuthCode, {
          userId: mockGoogleServer.MOCK_GOOGLE_USER.id,
          clientId: googleConfig.options.clientID,
          redirectUri: appCallbackUrl,
          scope: googleConfig.options.scope.join(' '),
      });

      const response = await agent
        .get(`/auth/google/callback?code=${mockAuthCode}`)
        .expect(200);

      expect(response.body.message).toBe('Google authentication successful!');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe(mockGoogleServer.MOCK_GOOGLE_USER.email);
      expect(response.body.user.provider).toBe('google');
      expect(response.body.user.providerId).toBe(mockGoogleServer.MOCK_GOOGLE_USER.id);
    });

    it('should redirect to /auth/login-failure if mock Google auth is denied', async () => {
      const agent = request.agent(app);
      const response = await agent
          .get('/auth/google/callback?error=access_denied')
          .expect(302);
      expect(response.headers.location).toBe('/auth/login-failure');
    });
  });

  // --- Facebook Auth Tests ---
  describe('Facebook OAuth Flow', () => {
    it('should redirect to the mock Facebook OAuth authorization URL', async () => {
      const response = await request(app).get('/auth/facebook').expect(302);
      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(facebookMockUrl);
      expect(redirectUrl.pathname).toBe('/dialog/oauth');
      const facebookConfig = config.oauthProviders.find(p => p.name === 'facebook');
      expect(redirectUrl.searchParams.get('client_id')).toBe(facebookConfig.options.clientID);
      const expectedRedirectUri = `http://127.0.0.1:${appServer.address().port}${facebookConfig.options.callbackURL}`;
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(expectedRedirectUri);
    });

    it('should return tokens and user info on successful mock Facebook auth callback', async () => {
      const agent = request.agent(app);
      const facebookConfig = config.oauthProviders.find(p => p.name === 'facebook');
      const appCallbackUrl = `http://127.0.0.1:${appServer.address().port}${facebookConfig.options.callbackURL}`;
      const mockAuthCode = 'test_fb_code_for_callback';

      mockFacebookServer.codes.set(mockAuthCode, {
          userId: mockFacebookServer.MOCK_FACEBOOK_USER.id,
          clientId: facebookConfig.options.clientID,
          redirectUri: appCallbackUrl,
          scope: facebookConfig.options.scope.join(','),
      });

      const response = await agent
        .get(`/auth/facebook/callback?code=${mockAuthCode}`)
        .expect(200);

      expect(response.body.message).toBe('Facebook authentication successful!');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe(mockFacebookServer.MOCK_FACEBOOK_USER.email);
      expect(response.body.user.provider).toBe('facebook');
      expect(response.body.user.providerId).toBe(mockFacebookServer.MOCK_FACEBOOK_USER.id);
    });
  });

  // --- GitHub Auth Tests ---
  describe('GitHub OAuth Flow', () => {
    it('should redirect to the mock GitHub OAuth authorization URL', async () => {
      const response = await request(app).get('/auth/github').expect(302);
      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(githubMockUrl);
      expect(redirectUrl.pathname).toBe('/login/oauth/authorize');
      const githubConfig = config.oauthProviders.find(p => p.name === 'github');
      expect(redirectUrl.searchParams.get('client_id')).toBe(githubConfig.options.clientID);
      const expectedRedirectUri = `http://127.0.0.1:${appServer.address().port}${githubConfig.options.callbackURL}`;
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(expectedRedirectUri);
    });

    it('should return tokens and user info on successful mock GitHub auth callback', async () => {
      const agent = request.agent(app);
      const githubConfig = config.oauthProviders.find(p => p.name === 'github');
      const appCallbackUrl = `http://127.0.0.1:${appServer.address().port}${githubConfig.options.callbackURL}`;
      const mockAuthCode = 'test_github_code_for_callback';

      mockGithubServer.codes.set(mockAuthCode, {
          userId: mockGithubServer.MOCK_GITHUB_USER.id,
          clientId: githubConfig.options.clientID,
          redirectUri: appCallbackUrl,
          scope: githubConfig.options.scope.join(' '),
      });

      const response = await agent
        .get(`/auth/github/callback?code=${mockAuthCode}`)
        .expect(200);

      expect(response.body.message).toBe('Github authentication successful!');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe(mockGithubServer.MOCK_GITHUB_USER.email);
      expect(response.body.user.provider).toBe('github');
      // GitHub IDs are numbers, ensure our app stores/returns them consistently (string or number)
      expect(response.body.user.providerId).toBe(mockGithubServer.MOCK_GITHUB_USER.id.toString());
    });

    it('should redirect to /auth/login-failure if mock GitHub auth is denied', async () => {
        const agent = request.agent(app);
        const response = await agent
            .get('/auth/github/callback?error=access_denied')
            .expect(302);

        expect(response.headers.location).toBe('/auth/login-failure');
    });
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
