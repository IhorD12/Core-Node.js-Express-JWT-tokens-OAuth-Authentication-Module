// tests/routes/authRoutes.test.js
const request = require('supertest');
// IMPORTANT: app and config must be required AFTER environment variables are set for mock URLs
// let app; // Declare here, require later
// let config;

const MockUserStore = require('../../src/auth/mockUserStore');
const userStoreInstance = new MockUserStore(); // Used for clearing users

// Import Mock Servers
const mockGoogleServer = require('../mocks/mockGoogleOAuthServer');
const mockFacebookServer = require('../mocks/mockFacebookOAuthServer');

describe('Auth Routes Integration Tests with Mock OAuth Servers', () => {
  let googleServer, facebookServer; // Instances of the mock servers (http.Server)
  let googleMockUrl, facebookMockUrl;
  let app; // Will be loaded after env vars are set
  let config; // Will be loaded after env vars are set

  beforeAll(async () => {
    // Start Google Mock Server
    googleServer = await mockGoogleServer.start(); // Starts on a random available port
    googleMockUrl = `http://localhost:${googleServer.address().port}`;
    process.env.GOOGLE_AUTHORIZATION_URL = `${googleMockUrl}/o/oauth2/v2/auth`;
    process.env.GOOGLE_TOKEN_URL = `${googleMockUrl}/oauth2/v4/token`;
    process.env.GOOGLE_USERINFO_URL = `${googleMockUrl}/oauth2/v3/userinfo`;

    // Start Facebook Mock Server
    facebookServer = await mockFacebookServer.start(); // Starts on a random available port
    facebookMockUrl = `http://localhost:${facebookServer.address().port}`;
    process.env.FACEBOOK_AUTHORIZATION_URL = `${facebookMockUrl}/dialog/oauth`;
    process.env.FACEBOOK_TOKEN_URL = `${facebookMockUrl}/oauth/access_token`;
    process.env.FACEBOOK_USER_PROFILE_URL = `${facebookMockUrl}/me`;

    // Set a distinct port for the main app to avoid conflicts
    process.env.PORT = '0'; // Or some other test-specific port for the main app
    process.env.NODE_ENV = 'test'; // Ensure test environment for config loading

    // Reset modules to ensure app and config load new env vars
    jest.resetModules();
    app = require('../../src/app'); // Load app after env vars are set
    config = require('../../config'); // Load config after env vars are set
  });

  afterAll(async () => {
    if (googleServer) await mockGoogleServer.stop();
    if (facebookServer) await mockFacebookServer.stop();
  });

  beforeEach(async () => {
    await userStoreInstance.clearAllUsers();
    // Reset any in-memory state in mock servers if necessary (e.g., codes map)
    // The current mock server stop/start in beforeAll/afterAll handles this for codes/tokens.
  });

  // --- Google Auth Tests ---
  describe('GET /auth/google (with mock server)', () => {
    it('should redirect to the mock Google OAuth authorization URL', async () => {
      const response = await request(app).get('/auth/google').expect(302);

      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(googleMockUrl);
      expect(redirectUrl.pathname).toBe('/o/oauth2/v2/auth');

      const googleConfig = config.oauthProviders.find(p => p.name === 'google');
      expect(redirectUrl.searchParams.get('client_id')).toBe(googleConfig.options.clientID);
      // The redirect_uri in the call to Google should be our app's full callback URL
      // This requires our app to know its own base URL during tests.
      // For now, we check it contains the path. A fuller check would be `http://127.0.0.1:${app_port}/auth/google/callback`
      expect(redirectUrl.searchParams.get('redirect_uri')).toContain(googleConfig.options.callbackURL);
    });
  });

  describe('GET /auth/google/callback (with mock server)', () => {
    it('should return tokens and user info on successful mock Google auth', async () => {
      const agent = request.agent(app); // Use agent to simulate user session/cookies if any

      // Step 1: Initiate OAuth flow to get a redirect to the mock provider
      // simulated_approval=true is a query param for the mock server to auto-approve
      const initialAuthResponse = await agent.get('/auth/google?simulated_approval=true').expect(302);
      const googleRedirectUrl = new URL(initialAuthResponse.headers.location);

      // Step 2: Simulate the user being redirected from Google back to our app's callback
      // The mock Google server would have added a 'code' to this redirect.
      // We need to capture that redirect from the mock server.
      // The mock server's /o/oauth2/v2/auth redirects to our app's /auth/google/callback with a code.

      // Instead of trying to intercept, let's assume the code is passed correctly.
      // The actual test of the redirect from mock server to our callback is complex with supertest alone.
      // We will directly call our callback with a code that the mock server would issue.

      const testClientId = config.oauthProviders.find(p=>p.name==='google').options.clientID;
      // The redirect_uri for code generation must match what the strategy will send to the token endpoint.
      // This is the app's own callback URL.
      const appCallbackUrl = `http://127.0.0.1:${app.settings.port || process.env.PORT}${config.oauthProviders.find(p=>p.name==='google').options.callbackURL}`;

      const mockAuthCode = 'test_google_code_for_callback';
      mockGoogleServer.codes.set(mockAuthCode, {
          userId: mockGoogleServer.MOCK_GOOGLE_USER.id,
          clientId: testClientId,
          redirectUri: appCallbackUrl,
          scope: 'profile email',
      });

      const response = await agent
        .get(`/auth/google/callback?code=${mockAuthCode}`) // Simulate Google redirecting to our callback
        .expect(200);

      expect(response.body.message).toBe('Google authentication successful!');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe(mockGoogleServer.MOCK_GOOGLE_USER.email);
      expect(response.body.user.provider).toBe('google');
      expect(response.body.user.providerId).toBe(mockGoogleServer.MOCK_GOOGLE_USER.id);
    });

    it('should redirect to /auth/login-failure if mock Google auth is denied at provider', async () => {
      const agent = request.agent(app);
      // Simulate Google redirecting to our callback with an error
      const response = await agent
          .get('/auth/google/callback?error=access_denied')
          .expect(302); // Passport's failureRedirect

      expect(response.headers.location).toBe('/auth/login-failure');
    });
  });

  // --- Facebook Auth Tests (similar structure) ---
  describe('GET /auth/facebook (with mock server)', () => {
    it('should redirect to the mock Facebook OAuth authorization URL', async () => {
      const response = await request(app).get('/auth/facebook').expect(302);
      const redirectUrl = new URL(response.headers.location);

      expect(redirectUrl.origin).toBe(facebookMockUrl);
      expect(redirectUrl.pathname).toBe('/dialog/oauth');
      const facebookConfig = config.oauthProviders.find(p => p.name === 'facebook');
      expect(redirectUrl.searchParams.get('client_id')).toBe(facebookConfig.options.clientID);
      expect(redirectUrl.searchParams.get('redirect_uri')).toContain(facebookConfig.options.callbackURL);
    });
  });

  describe('GET /auth/facebook/callback (with mock server)', () => {
    it('should return tokens and user info on successful mock Facebook auth', async () => {
      const agent = request.agent(app);
      const testClientId = config.oauthProviders.find(p=>p.name==='facebook').options.clientID;
      const appCallbackUrl = `http://127.0.0.1:${app.settings.port || process.env.PORT}${config.oauthProviders.find(p=>p.name==='facebook').options.callbackURL}`;
      const mockAuthCode = 'test_fb_code_for_callback';

      mockFacebookServer.codes.set(mockAuthCode, {
          userId: mockFacebookServer.MOCK_FACEBOOK_USER.id,
          clientId: testClientId,
          redirectUri: appCallbackUrl,
          scope: 'email public_profile',
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

    it('should redirect to /auth/login-failure if mock Facebook auth is denied at provider', async () => {
        const agent = request.agent(app);
        const response = await agent
            .get('/auth/facebook/callback?error=access_denied')
            .expect(302);

        expect(response.headers.location).toBe('/auth/login-failure');
    });
  });

  // --- Login Failure Route (Unaffected by mock servers) ---
  describe('GET /auth/login-failure', () => {
    it('should return 401 with a generic failure message', async () => {
        const response = await request(app) // app is loaded with actual config here
            .get('/auth/login-failure')
            .expect(401);
        expect(response.body.message).toBe('OAuth authentication failed. Please try again.');
    });
  });
});
