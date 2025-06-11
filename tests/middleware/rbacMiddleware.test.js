// tests/middleware/rbacMiddleware.test.js
const { checkRoles } = require('../../src/middleware/rbacMiddleware');
const logger = require('../../src/config/logger'); // Import logger to potentially mock its methods

// Mock logger to prevent console output during tests and spy on methods
jest.mock('../../src/config/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(), // Add other methods if used by middleware under test
}));

describe('RBAC Middleware (checkRoles)', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      user: {
        id: 'user123',
        roles: ['user'],
      },
      originalUrl: '/test/path', // For logging context
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    // Clear mock logger calls before each test
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  describe('Configuration Issues', () => {
    it('should call next() if no roles are required (empty array)', () => {
      const middleware = checkRoles([]);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no required roles specified'));
    });

    it('should return 500 if configured with invalid roles (e.g., empty string in array)', () => {
      const middleware = checkRoles(['user', '']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error: RBAC misconfiguration.' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('invalid role(s)'));
    });

    it('should return 500 if configured with invalid roles (e.g., non-string in array)', () => {
        const middleware = checkRoles(['user', 123]);
        middleware(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error: RBAC misconfiguration.' });
        expect(mockNext).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('invalid role(s)'));
      });
  });


  describe('Access Control', () => {
    it('should call next() if user has the required single role', () => {
      const middleware = checkRoles('user');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() if user has one of the required multiple roles', () => {
      const middleware = checkRoles(['admin', 'user']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not have the required single role', () => {
      const middleware = checkRoles('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: You do not have the required permissions.' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('User does not have required role(s)'),
        expect.objectContaining({ userId: 'user123', requiredRoles: ['admin'] })
      );
    });

    it('should return 403 if user does not have any of the required multiple roles', () => {
      mockReq.user.roles = ['editor'];
      const middleware = checkRoles(['admin', 'superuser']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: You do not have the required permissions.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user is not defined', () => {
      mockReq.user = undefined;
      const middleware = checkRoles('user');
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('User object or user.roles array not found'),
        expect.objectContaining({ userId: 'unknown' })
      );
    });

    it('should return 403 if req.user.roles is not an array', () => {
      mockReq.user.roles = 'user'; // Not an array
      const middleware = checkRoles('user');
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user.roles is an empty array and roles are required', () => {
      mockReq.user.roles = [];
      const middleware = checkRoles('user');
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
