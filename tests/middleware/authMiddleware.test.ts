// tests/middleware/authMiddleware.test.ts
import { verifyToken } from '@middleware/authMiddleware'; // Path alias
import passport from 'passport';
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import { Response, NextFunction } from 'express';
import { UserProfile } from '@adapters/userStoreAdapter'; // Path alias

// Mock passport.authenticate
// We need to mock the 'authenticate' method.
// The type for the callback function within passport.authenticate:
type PassportAuthenticateCallback = (
  err: any,
  user: UserProfile | false,
  info: any,
  status?: number // passport-jwt might pass status
) => void;

type AuthenticateReturnFunction = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void;

type MockAuthenticate = (
  strategy: string | string[] | passport.Strategy,
  options: passport.AuthenticateOptions | any, // Use any for options if complex or vary
  callback?: PassportAuthenticateCallback
) => AuthenticateReturnFunction;


// We are mocking the entire passport module to control authenticate
jest.mock('passport', () => ({
  // We need to return a function that then calls the callback,
  // mimicking how passport.authenticate works as a middleware generator.
  authenticate: jest.fn<AuthenticateReturnFunction, [
    string | string[] | passport.Strategy,
    passport.AuthenticateOptions | any,
    PassportAuthenticateCallback?
  ]>(),
}));


describe('Auth Middleware - verifyToken', () => {
  let mockReq: Partial<AuthenticatedRequest>; // Use Partial for mocks
  let mockRes: Partial<Response>;
  let mockNext: NextFunction; // jest.fn() will be assigned, which matches NextFunction type

  // Cast the mocked passport.authenticate to Jest's mock function type for typings
  const mockedPassportAuthenticate = passport.authenticate as jest.MockedFunction<MockAuthenticate>;

  beforeEach(() => {
    mockReq = {}; // Minimal request object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    mockedPassportAuthenticate.mockReset(); // Reset the mock for each test
  });

  it('should call next() and attach user to req if authentication is successful', () => {
    const mockUser: UserProfile = { id: '123', email: 'test@test.com', roles: ['user'], provider: 'test', providerId: '123', displayName: 'Test User', refreshTokens: [] };

    // Setup mockAuthenticate to simulate success
    mockedPassportAuthenticate.mockImplementation(
      (strategy, options, callback) => {
        return (req, res, next) => { // This is the function passport.authenticate returns
          if (callback) callback(null, mockUser, null);
        };
      }
    );

    verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockedPassportAuthenticate).toHaveBeenCalledWith('jwt', { session: false }, expect.any(Function));
    expect(mockReq.user).toEqual(mockUser);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(); // Called with no arguments
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 401 if authentication fails (no user)', () => {
    mockedPassportAuthenticate.mockImplementation(
      (strategy, options, callback) => {
        return (req, res, next) => {
          if (callback) callback(null, false, { message: 'No user found' });
        };
      }
    );

    verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockedPassportAuthenticate).toHaveBeenCalledWith('jwt', { session: false }, expect.any(Function));
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'No user found' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 with specific message for TokenExpiredError', () => {
    mockedPassportAuthenticate.mockImplementation(
      (strategy, options, callback) => {
        return (req, res, next) => {
          // passport-jwt passes error as first argument if token expires like this:
          // new TokenExpiredError('jwt expired', new Date(payload.exp * 1000))
          // Or sometimes info contains { name: 'TokenExpiredError', message: 'jwt expired' }
          // Let's simulate info containing the error name/message.
          if (callback) callback(null, false, { name: 'TokenExpiredError', message: 'jwt expired' });
        };
      }
    );

    verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Token expired. Please log in again.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 with specific message for JsonWebTokenError', () => {
    mockedPassportAuthenticate.mockImplementation(
      (strategy, options, callback) => {
        return (req, res, next) => {
          if (callback) callback(null, false, { name: 'JsonWebTokenError', message: 'invalid signature' });
        };
      }
    );

    verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token. Please log in again.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 if passport strategy encounters an error', () => {
    const strategyError = new Error('Strategy internal error');
    mockedPassportAuthenticate.mockImplementation(
      (strategy, options, callback) => {
        return (req, res, next) => {
          if (callback) callback(strategyError, false, null);
        };
      }
    );

    verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockedPassportAuthenticate).toHaveBeenCalledWith('jwt', { session: false }, expect.any(Function));
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Authentication error.', error: strategyError.message });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
