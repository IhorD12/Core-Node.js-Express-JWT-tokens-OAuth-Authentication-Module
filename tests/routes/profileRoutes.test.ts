// tests/routes/profileRoutes.test.ts
import request from 'supertest';
import app from '@src/app'; // Path alias
import authService from '@services/authService'; // Path alias
import userService from '@services/userService'; // Path alias
import MockUserStore from '@src/auth/mockUserStore'; // Path alias
import config from '@config/index'; // Path alias
import jwt from 'jsonwebtoken'; // For creating expired tokens
import { UserProfile } from '@adapters/userStoreAdapter'; // Path alias
import http from 'http'; // For http.Server type for appServer

const userStoreInstance = new MockUserStore();

describe('Profile Routes Integration Tests (/auth/profile)', () => {
  let mockUser: UserProfile;
  let adminUser: UserProfile;
  let validToken: string;
  let adminToken: string;
  let appServer: http.Server;

  beforeAll(async () => {
    // Ensure JWT_SECRET is set for token generation.
    // tests/setup.ts should handle setting a default test JWT_SECRET.
    // Start the main app on a dynamic port
    await new Promise<void>(resolve => {
        appServer = app.listen(0, () => resolve());
    });
    process.env.PORT = (appServer.address() as import('net').AddressInfo).port.toString();
  });

  afterAll(async () => {
    if (appServer) await new Promise<void>(resolve => appServer.close(() => resolve()));
  });

  beforeEach(async () => {
    await userStoreInstance.clearAllUsers();

    const regularUserProfile = {
      providerId: 'profileUser123',
      provider: 'testprovider-profile',
      displayName: 'Profile User',
      email: 'profile@example.com',
      photo: '', // Add photo if UserProfile expects it
    };
    mockUser = await userService.findOrCreateUser(regularUserProfile as any); // Cast as any if ProviderUserProfile is too strict here
    validToken = authService.generateAccessToken(mockUser); // Use generateAccessToken for clarity

    const adminUserProfile = {
      providerId: 'profileAdmin456',
      provider: 'testprovider-profile-admin',
      displayName: 'Profile Admin',
      email: 'profile.admin@example.com',
      photo: '',
    };
    adminUser = await userService.findOrCreateUser(adminUserProfile as any);

    // Manually update adminUser in store to have 'admin' role
    const adminUserInStore = (userStoreInstance.getUsers() as UserProfile[]).find(u => u.id === adminUser.id);
    if (adminUserInStore) {
      adminUserInStore.roles = ['user', 'admin'];
    }
    adminToken = authService.generateAccessToken(adminUser); // Generate token after role update
  });

  describe('GET /auth/profile', () => {
    it('should return 401 Unauthorized if no token is provided', async () => {
      await request(app)
        .get('/auth/profile')
        .expect(401);
    });

    it('should return 401 Unauthorized if token is invalid (e.g., malformed)', async () => {
      await request(app)
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalidtoken123')
        .expect(401);
    });

    it('should return 401 Unauthorized if token is expired', async () => {
      const expiredTokenPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        type: 'access', // Ensure type is correct
        iat: Math.floor(Date.now() / 1000) - 3600, // Issued 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
      };
      const expiredToken = jwt.sign(expiredTokenPayload, config.jwtSecret);

      await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should return 401 Unauthorized if token is valid but user not found in store', async () => {
      const userNotInStore = { id: 'nonexistent-user-456', email: 'no@example.com', roles: ['user'] }; // Minimal UserProfile like structure
      const tokenForNonExistentUser = authService.generateAccessToken(userNotInStore);

      await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${tokenForNonExistentUser}`)
        .expect(401);
    });

    it('should return 401 Unauthorized if token signature is invalid (tampered)', async () => {
       const parts = validToken.split('.');
       const tamperedToken = `${parts[0]}.${parts[1]}.InvalidSignaturePart`;

       await request(app)
           .get('/auth/profile')
           .set('Authorization', `Bearer ${tamperedToken}`)
           .expect(401);
    });

    it('should return 200 OK and user profile if token is valid and user exists', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile retrieved successfully!');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.user.email).toBe(mockUser.email);

      const userFromStore = await userService.findUserById(mockUser.id);
      expect(response.body.user).toEqual(expect.objectContaining({
          id: userFromStore!.id, // Add non-null assertion if confident
          email: userFromStore!.email,
          displayName: userFromStore!.displayName,
          roles: expect.arrayContaining(['user'])
      }));
    });
  });

  describe('Admin Routes RBAC Tests (/auth/admin/dashboard)', () => {
    it('should return 401 Unauthorized if no token is provided for admin route', async () => {
      await request(app)
        .get('/auth/admin/dashboard')
        .expect(401);
    });

    it('should return 403 Forbidden if user does not have "admin" role', async () => {
      await request(app)
        .get('/auth/admin/dashboard')
        .set('Authorization', `Bearer ${validToken}`) // regular user's token
        .expect(403)
        .then(response => {
          expect(response.body.message).toBe('Forbidden: You do not have the required permissions.');
        });
    });

    it('should return 200 OK if user has "admin" role', async () => {
      const response = await request(app)
        .get('/auth/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Welcome to the Admin Dashboard!');
      expect(response.body.adminDetails).toBeDefined();
      expect(response.body.adminDetails.userId).toBe(adminUser.id);
      expect(response.body.adminDetails.roles).toContain('admin');
    });
  });
});
