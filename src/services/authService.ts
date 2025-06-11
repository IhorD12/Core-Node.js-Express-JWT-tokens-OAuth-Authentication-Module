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

const { jwtSecret, refreshTokenExpirationSeconds, nodeEnv } = config;

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
  return jwt.sign(payload, jwtSecret);
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
  return jwt.sign(payload, jwtSecret);
};

/**
 * Generates and stores auth tokens (access and refresh) for a user.
 * @param {UserProfile} user - Full user object.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 * @throws {Error} If secrets are not defined or user is invalid.
 */
const generateAndStoreAuthTokens = async (user: UserProfile): Promise<{accessToken: string, refreshToken: string}> => {
  if (!jwtSecret || !refreshTokenExpirationSeconds) {
    throw new Error('JWT secrets or expiration settings are not defined.');
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
 * @returns {Promise<{accessToken: string, refreshToken: string}>} New token pair.
 * @throws {AuthError} If refresh token is invalid, expired, not found, user is not found, or secrets are missing.
 */
const refreshAuthTokens = async (providedRefreshToken: string): Promise<{accessToken: string, refreshToken: string}> => {
  if (!providedRefreshToken) {
    throw new AuthError('Refresh token is required.', 400);
  }

  let decoded: RefreshTokenPayload | AccessTokenPayload; // Union type, will check 'type'
  try {
    decoded = jwt.verify(providedRefreshToken, jwtSecret) as RefreshTokenPayload | AccessTokenPayload;
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') throw new AuthError('Refresh token expired. Please log in again.', 401);
    if (e.name === 'JsonWebTokenError') throw new AuthError('Invalid refresh token.', 401);
    throw e; // Other unexpected errors
  }

  if (decoded.type !== 'refresh') {
    throw new AuthError('Invalid token type. Expected refresh token.', 401);
  }

  const userId = decoded.sub;
  const isValidInStore = await userStore.validateRefreshToken(userId, providedRefreshToken);
  if (!isValidInStore) {
    throw new AuthError('Refresh token not recognized or has been invalidated.', 401);
  }

  await userStore.removeRefreshToken(userId, providedRefreshToken);

  const user = await userService.findUserById(userId);
  if (!user) {
    // This case should ideally not happen if token was valid in store, implies data inconsistency
    throw new AuthError('User not found for refresh token.', 401);
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshTokenString = generateRefreshToken(user); // Renamed to avoid conflict
  await userStore.addRefreshToken(userId, newRefreshTokenString);

  return { accessToken: newAccessToken, refreshToken: newRefreshTokenString };
};

/**
 * Logs out a user by invalidating a specific refresh token.
 * @param {string} providedRefreshToken - The refresh token to invalidate.
 * @returns {Promise<boolean>} True if token was found and removed from the store, false otherwise.
 * @throws {AuthError} If token is malformed, signature is invalid, or type is not 'refresh'.
 */
const logoutUser = async (providedRefreshToken: string): Promise<boolean> => {
  if (!providedRefreshToken) {
    throw new AuthError('Refresh token is required for logout.', 400);
  }

  let decoded: RefreshTokenPayload | AccessTokenPayload;
  try {
    decoded = jwt.verify(providedRefreshToken, jwtSecret, { ignoreExpiration: true }) as RefreshTokenPayload | AccessTokenPayload;
  } catch (e: any) {
    if (e.name === 'JsonWebTokenError') throw new AuthError('Invalid refresh token format.', 401);
    throw e; // Other unexpected errors
  }

  if (decoded.type !== 'refresh') {
     throw new AuthError('Invalid token type. Expected refresh token for logout.', 401);
  }

  const userId = decoded.sub;
  return userStore.removeRefreshToken(userId, providedRefreshToken);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateAndStoreAuthTokens,
  refreshAuthTokens,
  logoutUser,
  // Deprecated - kept for potential test compatibility during transition
  // Tests should be updated to use generateAndStoreAuthTokens or specific token generators
  generateToken: (user: UserProfile): string => {
    console.warn("DEPRECATED: generateToken in authService is deprecated. Use generateAndStoreAuthTokens or generateAccessToken.");
    return generateAccessToken(user);
  }
};
