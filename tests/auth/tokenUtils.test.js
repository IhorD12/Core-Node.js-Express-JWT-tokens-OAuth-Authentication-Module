// tests/auth/tokenUtils.test.js
const { generateToken } = require('../../src/auth/tokenUtils');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../../config');

describe('Auth Token Utilities', () => {
  describe('generateToken', () => {
    const mockUser = { id: 'testUser123', email: 'test@example.com' };
    const originalJwtSecret = jwtSecret; // Store original secret

    beforeAll(() => {
      // Ensure jwtSecret is set for these tests, even if .env is faulty for a moment
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
      // Update the imported jwtSecret if it was cached by the module
      require('../../config').jwtSecret = process.env.JWT_SECRET;
    });

    afterAll(() => {
      // Restore original secret if it was changed
      process.env.JWT_SECRET = originalJwtSecret;
      require('../../config').jwtSecret = originalJwtSecret;
    });

    it('should generate a valid JWT token for a user', () => {
      const token = generateToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include standard claims (sub, iat, exp) and user email in the payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, require('../../config').jwtSecret); // Use the potentially updated secret

      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should set expiration to 5 minutes (300 seconds)', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, require('../../config').jwtSecret);
      // Allow for a small drift in time (e.g., 1-2 seconds due to processing)
      expect(decoded.exp - decoded.iat).toBeCloseTo(300, 0);
    });

    it('should throw an error if JWT_SECRET is not defined', () => {
      const currentSecret = require('../../config').jwtSecret;
      require('../../config').jwtSecret = undefined; // Temporarily unset

      expect(() => generateToken(mockUser)).toThrow(
        'JWT_SECRET is not defined. Please set it in your .env file.'
      );

      require('../../config').jwtSecret = currentSecret; // Restore
    });

    it('should use the JWT_SECRET from config', () => {
      const token = generateToken(mockUser);
      // Attempt to verify with the same secret; if it fails, something is wrong
      expect(() => jwt.verify(token, require('../../config').jwtSecret)).not.toThrow();
    });
  });
});
