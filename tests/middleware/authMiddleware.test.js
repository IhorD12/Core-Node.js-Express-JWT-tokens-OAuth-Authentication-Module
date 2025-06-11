// tests/middleware/authMiddleware.test.js
const { verifyToken } = require('../../src/middleware/authMiddleware');
const passport = require('passport');

// Mock passport.authenticate
// jest.mock('passport') is tricky because passport is not just a function but an object with methods.
// We need to mock the 'authenticate' method.
const mockAuthenticate = jest.fn();
passport.authenticate = mockAuthenticate;

describe('Auth Middleware', () => {
  describe('verifyToken', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      // Reset the mock implementation for each test
      mockAuthenticate.mockReset();
    });

    it('should call next() and attach user to req if authentication is successful', () => {
      const mockUser = { id: '123', username: 'testuser' };
      // Setup mockAuthenticate to simulate success
      mockAuthenticate.mockImplementation((strategy, options, callback) => {
        return (req, res, next) => {
          // This is the function that passport.authenticate returns
          callback(null, mockUser, null); // (err, user, info)
        };
      });

      verifyToken(mockReq, mockRes, mockNext);

      expect(mockAuthenticate).toHaveBeenCalledWith(
        'jwt',
        { session: false },
        expect.any(Function)
      );
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(); // Called with no arguments
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if authentication fails (no user)', () => {
      // Setup mockAuthenticate to simulate failure (no user)
      mockAuthenticate.mockImplementation((strategy, options, callback) => {
        return (req, res, next) => {
          callback(null, false, { message: 'No user found' });
        };
      });

      verifyToken(mockReq, mockRes, mockNext);

      expect(mockAuthenticate).toHaveBeenCalledWith(
        'jwt',
        { session: false },
        expect.any(Function)
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'No user found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific message for TokenExpiredError', () => {
      mockAuthenticate.mockImplementation((strategy, options, callback) => {
        return (req, res, next) => {
          callback(null, false, { name: 'TokenExpiredError', message: 'jwt expired' });
        };
      });

      verifyToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Token expired. Please log in again.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with specific message for JsonWebTokenError', () => {
      mockAuthenticate.mockImplementation((strategy, options, callback) => {
        return (req, res, next) => {
          callback(null, false, { name: 'JsonWebTokenError', message: 'invalid signature' });
        };
      });

      verifyToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token. Please log in again.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if passport strategy encounters an error', () => {
      const strategyError = new Error('Strategy error');
      // Setup mockAuthenticate to simulate strategy error
      mockAuthenticate.mockImplementation((strategy, options, callback) => {
        return (req, res, next) => {
          callback(strategyError, false, null);
        };
      });

      verifyToken(mockReq, mockRes, mockNext);

      expect(mockAuthenticate).toHaveBeenCalledWith(
        'jwt',
        { session: false },
        expect.any(Function)
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication error.',
        error: strategyError.message,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
