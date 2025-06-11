// tests/routes/authRoutes.test.js
const request = require('supertest');
const app = require('../../app'); // Our Express app
const passport = require('passport'); // The mocked passport
const { clearUsers, findUserByProfileId } = require('../../auth/mockUserStore'); // To check user creation
const { generateToken } = require('../../auth/tokenUtils'); // To create valid tokens for other tests if needed

describe('Auth Routes Integration Tests', () => {
  let server;

  beforeAll((done) => {
    // It's good practice to start the server once before all tests in the suite
    // However, since app.js exports the app and server.js conditionally listens,
    // we can directly use the app object with supertest.
    // server = app.listen(0, done); // Listen on a random free port
    // For now, let's assume supertest handles server starting/stopping with app
    done();
  });

  afterAll((done) => {
    // if (server) {
    //   server.close(done);
    // } else {
    //   done();
    // }
    done();
  });

  beforeEach(() => {
    clearUsers(); // Clear mock user store before each test
    passport.authenticate.mockReset(); // Reset passport mock before each test
  });

  // --- Google Auth Tests ---
  describe('GET /auth/google', () => {
    it('should redirect to Google OAuth screen (simulated)', (done) => {
      passport.authenticate.mockImplementation((strategy, options) => {
        expect(strategy).toBe('google');
        expect(options.scope).toEqual(['profile', 'email']);
        return (req, res, next) => {
          // In a real scenario, passport-google-oauth20 would redirect.
          // We simulate this by sending a 200 OK with a message for the test.
          // Or, more accurately, the middleware would call something on res to redirect.
          // For this test, we just want to confirm our route calls passport.authenticate.
          res.status(200).send('Redirecting to Google...');
        };
      });

      request(app)
        .get('/auth/google')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(passport.authenticate).toHaveBeenCalledWith('google', expect.objectContaining({ session: false, scope: ['profile', 'email'] }));
          expect(res.text).toContain('Redirecting to Google...');
          done();
        });
    });
  });

  describe('GET /auth/google/callback', () => {
    it('should return JWT and user info on successful Google auth', async () => {
      const mockGoogleProfile = { id: 'google123', displayName: 'Google User', emails: [{ value: 'google@example.com' }] };
      const mockUser = { id: `google-${mockGoogleProfile.id}`, email: mockGoogleProfile.emails[0].value };
      const mockToken = 'mockGoogleJwtToken';

      passport.authenticate.mockImplementation((strategy, options, callbackOrCustomHandler) => {
        expect(strategy).toBe('google');
        return (req, res, next) => {
          // This is the custom callback defined in our authRoutes.js
          // It expects (err, data, info) where data is { user, token }
          // Our strategy (googleStrategy.js) calls done(null, { user: createdUser, token: generatedJwt })
          callbackOrCustomHandler(null, { user: mockUser, token: mockToken }, null);
        };
      });

      const response = await request(app)
        .get('/auth/google/callback?code=someauthcode') // query params are typical for OAuth callbacks
        .expect(200);

      expect(passport.authenticate).toHaveBeenCalledWith('google', expect.objectContaining({ session: false }));
      expect(response.body.message).toBe('Google authentication successful!');
      expect(response.body.token).toBe(mockToken);
      expect(response.body.user).toEqual(mockUser);

      // Verify user was created in mock store
      const userInStore = await findUserByProfileId(mockGoogleProfile.id, 'google');
      // Note: Our current mockUserStore in the test setup doesn't actually get populated by the
      // mocked strategy. The strategy itself (googleStrategy.js) is not being run here, only its callback.
      // To test user creation properly, we'd need a more sophisticated mock or to test the strategy directly.
      // For this route test, we are focusing on the route's behavior given the strategy's output.
    });

    it('should return 401 if Google auth fails (no token from strategy)', async () => {
      passport.authenticate.mockImplementation((strategy, options, callbackOrCustomHandler) => {
        return (req, res, next) => {
          callbackOrCustomHandler(null, false, { message: 'Google auth failed by mock' }); // Simulate strategy calling done(null, false)
        };
      });

      const response = await request(app)
        .get('/auth/google/callback?error=someerror')
        .expect(401);

      expect(response.body.message).toBe('Google auth failed by mock');
    });

     it('should return 500 if Google strategy passes an error', async () => {
         passport.authenticate.mockImplementation((strategy, options, callbackOrCustomHandler) => {
             return (req, res, next) => {
                 callbackOrCustomHandler(new Error('Big Google Error'), false, null);
             };
         });

         const response = await request(app)
             .get('/auth/google/callback?code=whatever')
             .expect(500);

         expect(response.body.message).toBe('Authentication failed during Google callback.');
         expect(response.body.error).toBe('Big Google Error');
     });
  });

  // --- Facebook Auth Tests (similar structure to Google) ---
  describe('GET /auth/facebook', () => {
    it('should attempt to authenticate with Facebook', (done) => {
      passport.authenticate.mockImplementation((strategy, options) => {
        expect(strategy).toBe('facebook');
        return (req, res, next) => res.status(200).send('Redirecting to Facebook...');
      });

      request(app).get('/auth/facebook').expect(200).end(done);
    });
  });

  describe('GET /auth/facebook/callback', () => {
    it('should return JWT and user info on successful Facebook auth', async () => {
      const mockFbProfile = { id: 'fb789', displayName: 'Facebook User', emails: [{ value: 'fb@example.com' }] };
      const mockUser = { id: `facebook-${mockFbProfile.id}`, email: mockFbProfile.emails[0].value };
      const mockToken = 'mockFacebookJwtToken';

      passport.authenticate.mockImplementation((strategy, options, callbackOrCustomHandler) => {
        expect(strategy).toBe('facebook');
        return (req, res, next) => {
          callbackOrCustomHandler(null, { user: mockUser, token: mockToken }, null);
        };
      });

      const response = await request(app)
        .get('/auth/facebook/callback?code=someauthcode')
        .expect(200);

      expect(response.body.token).toBe(mockToken);
      expect(response.body.user).toEqual(mockUser);
    });

    it('should return 401 if Facebook auth fails (no token from strategy)', async () => {
      passport.authenticate.mockImplementation((strategy, options, callbackOrCustomHandler) => {
        return (req, res, next) => {
          callbackOrCustomHandler(null, false, { message: 'FB auth failed' });
        };
      });

      const response = await request(app)
        .get('/auth/facebook/callback?error=someerror')
        .expect(401);
      expect(response.body.message).toBe('FB auth failed');
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
