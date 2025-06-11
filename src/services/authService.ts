// src/services/authService.ts
/**
 * @fileoverview Authentication Service for managing tokens and auth operations.
 */
import jwt from 'jsonwebtoken';
import config from '@config/index'; // Path alias
import MockUserStore from '@src/auth/mockUserStore'; // Path alias
import MongoUserAdapter from '@adapters/mongoUserAdapter';
import PostgresUserAdapter from '@adapters/postgresUserAdapter';
import UserStoreAdapter, { UserProfile } from '@adapters/userStoreAdapter'; // For UserProfile type
import userService from './userService'; // For user lookups

// Instantiate the store based on configuration
let userStore: UserStoreAdapter;
if (config.userStoreType === 'mongodb') {
  userStore = new MongoUserAdapter();
} else if (config.userStoreType === 'postgres') {
  userStore = new PostgresUserAdapter();
} else { // Default to mock store
  userStore = new MockUserStore();
}

const {
  jwtAlgorithm,
  jwtSecret,
  jwtPrivateKey,
  jwtPublicKey,
  refreshTokenExpirationSeconds,
  nodeEnv
} = config;

// Access token expiration
const ACCESS_TOKEN_EXPIRATION_SECONDS: number = (nodeEnv === 'test' ? 5 * 60 : 15 * 60);

// Define payload interfaces
interface AccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  email?: string | null;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  type: 'refresh';
}

/**
 * Generates an access token for a given user.
 * @param {Pick<UserProfile, 'id' | 'email'>} user - User object containing id and email.
 * @returns {string} JWT access token.
 */
const generateAccessToken = (user: Pick<UserProfile, 'id' | 'email'>): string => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate access token.');
  }
  const payload: AccessTokenPayload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRATION_SECONDS,
    email: user.email,
    type: 'access',
  };
  const secretOrKey = jwtAlgorithm === 'RS256' ? jwtPrivateKey! : jwtSecret!;
  if (!secretOrKey) throw new Error(`Missing key for ${jwtAlgorithm} token generation.`);
  return jwt.sign(payload, secretOrKey, { algorithm: jwtAlgorithm });
};

/**
 * Generates a refresh token for a given user.
 * @param {Pick<UserProfile, 'id'>} user - User object containing id.
 * @returns {string} JWT refresh token.
 */
const generateRefreshToken = (user: Pick<UserProfile, 'id'>): string => {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate refresh token.');
  }
  const payload: RefreshTokenPayload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + refreshTokenExpirationSeconds,
    type: 'refresh',
  };
  const secretOrKey = jwtAlgorithm === 'RS256' ? jwtPrivateKey! : jwtSecret!;
  if (!secretOrKey) throw new Error(`Missing key for ${jwtAlgorithm} token generation.`);
  return jwt.sign(payload, secretOrKey, { algorithm: jwtAlgorithm });
};

/**
 * Generates and stores auth tokens (access and refresh) for a user.
 * @param {UserProfile} user - Full user object.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 * @throws {Error} If secrets/keys are not defined or user is invalid.
 */
const generateAndStoreAuthTokens = async (user: UserProfile): Promise<{accessToken: string, refreshToken: string}> => {
  if (jwtAlgorithm === 'HS256' && !jwtSecret) {
    throw new Error('JWT_SECRET is not defined for HS256 algorithm.');
  }
  if (jwtAlgorithm === 'RS256' && (!jwtPrivateKey || !jwtPublicKey)) { // PublicKey needed for verification by self if any
    throw new Error('JWT_PRIVATE_KEY or JWT_PUBLIC_KEY is not defined for RS256 algorithm.');
  }
  if (!refreshTokenExpirationSeconds) {
    throw new Error('REFRESH_TOKEN_EXPIRATION_SECONDS is not defined in config.');
  }
  if (!user || !user.id) {
    throw new Error('User object with an ID is required.');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await userStore.addRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
};

/**
 * Custom error class for auth operations that can include a status code.
 */
class AuthError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = this.constructor.name;
        if (status) {
            this.status = status;
        }
    }
}


/**
 * Refreshes authentication tokens using a provided valid refresh token.
 * Implements rolling refresh tokens. New tokens are generated, old refresh token is invalidated.
 * @param {string} providedRefreshToken - The refresh token from the client.
 * @param {string} [clientIp] - Optional client IP address for logging.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} New token pair.
 * @throws {AuthError} If refresh token is invalid, expired, not found, user is not found, or keys/secrets are missing.
 */
const refreshAuthTokens = async (providedRefreshToken: string, clientIp?: string): Promise<{accessToken: string, refreshToken: string}> => {
  if (!providedRefreshToken) {
    logger.warn('Refresh token attempt failed: No token provided.', { ip: clientIp });
    throw new AuthError('Refresh token is required.', 400);
  }

  let decoded: RefreshTokenPayload | AccessTokenPayload;
  try {
    const keyToUse = jwtAlgorithm === 'RS256' ? jwtPublicKey! : jwtSecret!;
    if (!keyToUse) {
        logger.error('JWT verification key missing for current algorithm.', { algorithm: jwtAlgorithm, ip: clientIp });
        throw new AuthError(`Missing key for ${jwtAlgorithm} token verification.`, 500);
    }
    decoded = jwt.verify(providedRefreshToken, keyToUse, { algorithms: [jwtAlgorithm] }) as RefreshTokenPayload | AccessTokenPayload;
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
        logger.warn('Refresh token expired.', { userId: (jwt.decode(providedRefreshToken) as any)?.sub, ip: clientIp, error: e.message });
        throw new AuthError('Refresh token expired. Please log in again.', 401);
    }
    if (e.name === 'JsonWebTokenError') {
        logger.warn('Invalid refresh token structure or signature.', { ip: clientIp, error: e.message });
        throw new AuthError('Invalid refresh token.', 401);
    }
    logger.error('Unexpected error during refresh token verification.', { ip: clientIp, error: e.message });
    throw e;
  }

  if (decoded.type !== 'refresh') {
    logger.warn('Invalid token type used for refresh.', { userId: decoded.sub, type: decoded.type, ip: clientIp });
    throw new AuthError('Invalid token type. Expected refresh token.', 401);
  }

  const userId = decoded.sub;
  const isValidInStore = await userStore.validateRefreshToken(userId, providedRefreshToken);
  if (!isValidInStore) {
    logger.warn('Refresh token not recognized or invalidated in store.', { userId, ip: clientIp });
    throw new AuthError('Refresh token not recognized or has been invalidated.', 401);
  }

  await userStore.removeRefreshToken(userId, providedRefreshToken);

  const user = await userService.findUserById(userId);
  if (!user) {
    logger.error('User not found for valid refresh token during refresh.', { userId, ip: clientIp });
    throw new AuthError('User not found for refresh token.', 401); // Should be rare if token was valid
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshTokenString = generateRefreshToken(user);
  await userStore.addRefreshToken(userId, newRefreshTokenString);

  logger.info('Access token refreshed successfully', { userId, ip: clientIp });
  return { accessToken: newAccessToken, refreshToken: newRefreshTokenString };
};

/**
 * Logs out a user by invalidating a specific refresh token.
 * @param {string} providedRefreshToken - The refresh token to invalidate.
 * @param {string} [clientIp] - Optional client IP address for logging.
 * @returns {Promise<boolean>} True if token was found and removed from the store, false otherwise.
 * @throws {AuthError} If token is malformed, signature is invalid, or type is not 'refresh'.
 */
const logoutUser = async (providedRefreshToken: string, clientIp?: string): Promise<boolean> => {
  if (!providedRefreshToken) {
    // This case might not be logged with IP if token isn't even provided
    logger.warn('Logout attempt failed: No refresh token provided.', { ip: clientIp });
    throw new AuthError('Refresh token is required for logout.', 400);
  }

  let decoded: RefreshTokenPayload | AccessTokenPayload;
  try {
    const keyToUse = jwtAlgorithm === 'RS256' ? jwtPublicKey! : jwtSecret!;
    if (!keyToUse) {
        logger.error('JWT verification key missing for current algorithm during logout.', { algorithm: jwtAlgorithm, ip: clientIp });
        throw new AuthError(`Missing key for ${jwtAlgorithm} token verification.`, 500);
    }
    decoded = jwt.verify(providedRefreshToken, keyToUse, {
      algorithms: [jwtAlgorithm],
      ignoreExpiration: true
    }) as RefreshTokenPayload | AccessTokenPayload;
  } catch (e: any) {
    if (e.name === 'JsonWebTokenError') {
        logger.warn('Logout attempt with invalid refresh token format.', { ip: clientIp, error: e.message });
        throw new AuthError('Invalid refresh token format.', 401);
    }
    logger.error('Unexpected error during logout token verification.', { ip: clientIp, error: e.message });
    throw e;
  }

  if (decoded.type !== 'refresh') {
    logger.warn('Invalid token type used for logout.', { userId: decoded.sub, type: decoded.type, ip: clientIp });
    throw new AuthError('Invalid token type. Expected refresh token for logout.', 401);
  }

  const userId = decoded.sub;
  const removed = await userStore.removeRefreshToken(userId, providedRefreshToken);
  if (removed) {
    logger.info('User logout successful, refresh token invalidated', { userId, ip: clientIp });
  } else {
    logger.info('Logout attempt for already invalid/unknown refresh token', { userId, ip: clientIp });
  }
  return removed;
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateAndStoreAuthTokens,
  refreshAuthTokens,
  logoutUser,
  generateToken: (user: UserProfile): string => {
    console.warn("DEPRECATED: generateToken in authService is deprecated. Use generateAndStoreAuthTokens or generateAccessToken.");
    return generateAccessToken(user); // This will use the configured algorithm
  }
};
