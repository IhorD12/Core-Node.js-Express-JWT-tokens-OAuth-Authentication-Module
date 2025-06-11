// src/auth/strategies/jwtStrategy.ts
/**
 * @fileoverview Passport JWT Strategy Configuration Function.
 * Returns a Passport strategy instance for verifying JWT access tokens.
 */
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions as JwtStrategyOptions, VerifiedCallback } from 'passport-jwt';
import config from '@config/index'; // Path alias for default jwtSecret
import { UserService } from '@services/userService'; // Assuming type export
import { UserProfile } from '@adapters/userStoreAdapter'; // For user object type
import logger from '@config/logger';

interface StrategyServices {
  userService: UserService;
}

// Define the expected payload structure for our access tokens
interface AccessTokenPayload {
  sub: string; // User ID
  type: 'access';
  email?: string;
  // any other claims present in the access token
  iat: number;
  exp: number;
}

// Options for this specific strategy configuration function
interface JwtStrategySetupOptions {
  jwtSecret?: string; // Allow overriding default secret from main config
}

const configureStrategy = (
  options: JwtStrategySetupOptions = {}, // Options could include a specific publicKey if needed, otherwise defaults to config
  services: StrategyServices
): JwtStrategy => {
  let secretOrPublicKey: string;
  if (config.jwtAlgorithm === 'RS256') {
    if (!config.jwtPublicKey) {
      const errMsg = 'JWT_PUBLIC_KEY is not configured for RS256 algorithm.';
      logger.error(errMsg);
      throw new Error(errMsg);
    }
    secretOrPublicKey = config.jwtPublicKey;
  } else { // HS256
    if (!config.jwtSecret) {
      const errMsg = 'JWT_SECRET is not configured for HS256 algorithm.';
      logger.error(errMsg);
      throw new Error(errMsg);
    }
    secretOrPublicKey = config.jwtSecret;
  }

  if (!services || !services.userService) {
    const errMsg = 'userService must be provided to JWT strategy.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  const jwtOptions: JwtStrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: secretOrPublicKey,
    algorithms: [config.jwtAlgorithm], // Specify algorithm for verification
  };

  return new JwtStrategy(jwtOptions,
    async (jwt_payload: AccessTokenPayload, done: VerifiedCallback) => {
      logger.debug('JWT Payload received for validation', { sub: jwt_payload.sub, type: jwt_payload.type, alg: config.jwtAlgorithm });
      try {
        // Type check is already part of AccessTokenPayload if defined strictly
        if (jwt_payload.type !== 'access') {
          logger.warn('Invalid token type received by JWT strategy.', { type: jwt_payload.type });
          return done(null, false, { message: 'Invalid token type. Expected access token.' });
        }

        const user: UserProfile | null = await services.userService.findUserById(jwt_payload.sub);
        if (user) {
          // Attach the user object (which includes roles) to the request
          return done(null, user);
        } else {
          logger.warn('User not found for JWT sub claim.', { sub: jwt_payload.sub });
          return done(null, false, { message: 'User not found.' });
        }
      } catch (error: any) {
        logger.error('Error in JWT Strategy verification callback:', { message: error.message, stack: error.stack });
        return done(error, false);
      }
    }
  );
};

export default configureStrategy;
