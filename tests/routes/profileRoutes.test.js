// tests/routes/profileRoutes.test.js
const request = require('supertest');
const app = require('../../app'); // Our Express app
const { generateToken } = require('../../auth/tokenUtils');
const { findUserById, clearUsers, findOrCreateUser } = require('../../auth/mockUserStore');
const { jwtSecret } = require('../../config'); // For direct JWT manipulation if needed for specific tests
const jwt = require('jsonwebtoken'); // For creating expired tokens

describe('Profile Routes Integration Tests (/auth/profile)', () => {
  let mockUser;
  let validToken;

  beforeAll(async () => {
    // Ensure JWT_SECRET is set for token generation
    // This is also done in tests/setup.js but good to be defensive
    if (!require('../../config').jwtSecret) { // Check the currently loaded config
      process.env.JWT_SECRET = 'test_jwt_secret_for_jest_profile';
      // Update the imported jwtSecret if it was cached by the module
      // This requires re-requiring or directly modifying the cached config object.
      // For simplicity, ensure tests/setup.js has set it.
      // If config/index.js has already been loaded and cached jwtSecret,
      // process.env change might not reflect immediately.
      // Best practice: tests/setup.js handles this. We rely on that.
    }
  });

  beforeEach(async () => {
    clearUsers();
    // Create a mock user in the store for JWT strategy to find
    const userProfile = { id: 'profileUser123', displayName: 'Profile User', emails: [{ value: 'profile@example.com' }] };
    // findOrCreateUser will create an ID like 'testprovider-profileUser123'
    // The token's 'sub' claim will be this user.id.
    mockUser = await findOrCreateUser(userProfile, 'testprovider');
    validToken = generateToken(mockUser);
  });

  it('should return 401 Unauthorized if no token is provided', async () => {
    const response = await request(app)
      .get('/auth/profile')
      .expect(401);
    // Message can vary slightly based on passport-jwt version or if some other middleware interferes.
    // authMiddleware provides specific messages.
    expect(response.body.message).toMatch(/No auth token|Unauthorized/i);
  });

  it('should return 401 Unauthorized if token is invalid (e.g., malformed)', async () => {
    const response = await request(app)
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalidtoken123')
      .expect(401);
    expect(response.body.message).toMatch(/Invalid token|jwt malformed|Format is Authorization: Bearer \[token\]/i);
  });

  it('should return 401 Unauthorized if token is expired', async () => {
    // Create an expired token
    const expiredTokenPayload = {
      sub: mockUser.id,
      email: mockUser.email,
      iat: Math.floor(Date.now() / 1000) - 3600, // Issued 1 hour ago
      exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
    };
    // Use the jwtSecret from the config, which should be set by tests/setup.js
    const currentJwtSecret = require('../../config').jwtSecret;
    const expiredToken = jwt.sign(expiredTokenPayload, currentJwtSecret);

    const response = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    expect(response.body.message).toMatch(/Token expired|jwt expired/i);
  });

  it('should return 401 Unauthorized if token is valid but user not found in store', async () => {
    const userNotInStore = { id: 'nonexistent-user-456', email: 'no@example.com' };
    // This user is not saved to mockUserStore
    const tokenForNonExistentUser = generateToken(userNotInStore);

    const response = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${tokenForNonExistentUser}`)
      .expect(401);
    // This message comes from our custom callback in jwtStrategy.js
    expect(response.body.message).toBe('User not found.');
  });

  it('should return 401 Unauthorized if token signature is invalid (tampered)', async () => {
     const parts = validToken.split('.');
     const tamperedToken = `${parts[0]}.${parts[1]}.InvalidSignaturePart`;

     const response = await request(app)
         .get('/auth/profile')
         .set('Authorization', `Bearer ${tamperedToken}`)
         .expect(401);
     expect(response.body.message).toMatch(/Invalid token|invalid signature/i);
  });

  it('should return 200 OK and user profile if token is valid and user exists', async () => {
    // mockUser is in the store from beforeEach, validToken is for mockUser.
    const response = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.message).toBe('Profile retrieved successfully!');
    expect(response.body.user).toBeDefined();
    expect(response.body.user.id).toBe(mockUser.id);
    expect(response.body.user.email).toBe(mockUser.email);

    // Verify against the object structure our mockUserStore provides
    const userFromStore = await findUserById(mockUser.id);
    expect(response.body.user).toEqual(expect.objectContaining({
        id: userFromStore.id,
        provider: userFromStore.provider,
        providerId: userFromStore.providerId,
        displayName: userFromStore.displayName,
        email: userFromStore.email,
        photo: userFromStore.photo,
    }));
  });
});
