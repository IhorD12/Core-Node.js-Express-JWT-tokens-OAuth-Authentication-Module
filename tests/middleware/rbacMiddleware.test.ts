// tests/middleware/rbacMiddleware.test.ts
import { checkRoles } from '@middleware/rbacMiddleware'; // Path alias
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import { Response, NextFunction } from 'express';
import logger from '@config/logger'; // Path alias

// Mock logger
jest.mock('@config/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
}));

describe('RBAC Middleware (checkRoles)', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  // Cast logger methods to jest.Mock for type safety in tests
  const mockedLoggerError = logger.error as jest.Mock;
  const mockedLoggerWarn = logger.warn as jest.Mock;

  beforeEach(() => {
    mockReq = {
      user: { // Mock UserProfile structure
        id: 'user123',
        roles: ['user'],
        provider: 'test',
        providerId: 'test123',
        displayName: 'Test User',
        email: 'test@example.com',
        refreshTokens: [],
      },
      originalUrl: '/test/path',
      ip: '127.0.0.1',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    mockedLoggerError.mockClear();
    mockedLoggerWarn.mockClear();
  });

  describe('Configuration Issues', () => {
    it('should call next() if no roles are required (empty array)', () => {
      const middleware = checkRoles([]);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockedLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('no required roles specified'));
    });

    it('should return 500 if configured with invalid roles (empty string in array)', () => {
      const middleware = checkRoles(['user', '']);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error: RBAC misconfiguration.' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedLoggerError).toHaveBeenCalledWith(expect.stringContaining('invalid role(s)'));
    });

    it('should return 500 if configured with invalid roles (non-string in array)', () => {
        const middleware = checkRoles(['user', 123 as any]); // Cast to any to bypass TS for test
        middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error: RBAC misconfiguration.' });
        expect(mockNext).not.toHaveBeenCalled();
        expect(mockedLoggerError).toHaveBeenCalledWith(expect.stringContaining('invalid role(s)'));
      });
  });


  describe('Access Control', () => {
    it('should call next() if user has the required single role', () => {
      const middleware = checkRoles('user');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() if user has one of the required multiple roles', () => {
      const middleware = checkRoles(['admin', 'user']);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not have the required single role', () => {
      const middleware = checkRoles('admin');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: You do not have the required permissions.' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('User does not have required role(s)'),
        expect.objectContaining({ userId: 'user123', requiredRoles: ['admin'] })
      );
    });

    it('should return 403 if user does not have any of the required multiple roles', () => {
      if (mockReq.user) mockReq.user.roles = ['editor'];
      const middleware = checkRoles(['admin', 'superuser']);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: You do not have the required permissions.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user is not defined', () => {
      mockReq.user = undefined;
      const middleware = checkRoles('user');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('User object or user.roles array not found'),
        expect.objectContaining({ userId: 'unknown' })
      );
    });

    it('should return 403 if req.user.roles is not an array', () => {
      if (mockReq.user) mockReq.user.roles = 'user' as any; // Test invalid type
      const middleware = checkRoles('user');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user.roles is an empty array and roles are required', () => {
      if (mockReq.user) mockReq.user.roles = [];
      const middleware = checkRoles('user');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden: Insufficient permissions (user roles not available or not assigned).' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
