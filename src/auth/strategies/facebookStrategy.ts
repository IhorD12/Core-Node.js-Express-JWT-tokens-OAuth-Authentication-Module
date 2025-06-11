// src/auth/strategies/facebookStrategy.ts
/**
 * @fileoverview Facebook OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for Facebook.
 */
import { Strategy as FacebookStrategy, Profile as FacebookProfile, StrategyOptionWithRequest } from 'passport-facebook';
import { VerifyFunctionWithRequest, VerifyFunction } from 'passport-facebook'; // For typing 'done'
import { ConfiguredOAuthProvider } from '@config/index';
import { UserService } from '@services/userService';
import { AuthService } from '@services/authService';
import { ProviderUserProfile } from '@adapters/userStoreAdapter';
import logger from '@config/logger';

interface StrategyServices {
  userService: UserService;
  authService: AuthService;
}

// Extract relevant options for Facebook from the generic config type
type FacebookStrategyOptionsFromConfig = Pick<
    ConfiguredOAuthProvider['options'],
    'clientID' | 'clientSecret' | 'callbackURL' | 'scope' | 'profileFields' |
    'authorizationURL' | 'tokenURL' | 'profileURL'
>;

const configureStrategy = (
    options: FacebookStrategyOptionsFromConfig,
    services: StrategyServices
): FacebookStrategy => {
  if (!options.clientID || !options.clientSecret || !options.callbackURL || !options.profileURL) {
    const errMsg = 'Facebook Strategy: Missing critical options (clientID, clientSecret, callbackURL, profileURL).';
    logger.error(errMsg, { optionsProvided: Object.keys(options) });
    throw new Error(errMsg);
  }
  if (!services || !services.userService || !services.authService) {
    const errMsg = 'userService and authService must be provided to Facebook strategy.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  const strategyActualOptions: StrategyOptionWithRequest = { // passport-facebook uses StrategyOptionWithRequest
    clientID: options.clientID,
    clientSecret: options.clientSecret,
    callbackURL: options.callbackURL,
    scope: options.scope as string[] || ['email', 'public_profile'], // Ensure scope is string[]
    profileFields: options.profileFields || ['id', 'displayName', 'emails', 'photos', 'name'],
    authorizationURL: options.authorizationURL,
    tokenURL: options.tokenURL,
    profileURL: options.profileURL,
    passReqToCallback: false, // Set to false as we are not using req in callback
  };

  // Type for the 'done' callback: Using VerifyFunction which matches (err, user, info)
  // If passReqToCallback were true, it would be VerifyFunctionWithRequest
  const verifyCallback: VerifyFunction = async (
      accessToken: string, // accessToken from Facebook
      providedRefreshToken: string | undefined, // refreshToken from Facebook (if any)
      profile: FacebookProfile,
      done // This 'done' is (err: any, user?: any, info?: any) => void
  ) => {
    logger.debug('Facebook Profile received', { profileId: profile.id, displayName: profile.displayName });
    try {
      if (!profile || !profile.id) {
        logger.warn('Facebook profile is invalid or missing ID.', { profile });
        return done(new Error("Facebook profile is invalid or missing ID."));
      }

      // The `userService.findOrCreateUser` expects a raw PassportProfile and provider name
      const user = await services.userService.findOrCreateUser(profile, 'facebook');
      if (!user) {
        logger.error('Failed to find or create user from Facebook profile.', { profile });
        return done(new Error("Could not find or create user from Facebook profile."));
      }

      const { accessToken: appAccessToken, refreshToken: appRefreshToken } =
          await services.authService.generateAndStoreAuthTokens(user);

      return done(null, { user, accessToken: appAccessToken, refreshToken: appRefreshToken });

    } catch (error: any) {
      logger.error('Error in Facebook Strategy verification callback:', { message: error.message, stack: error.stack });
      return done(error);
    }
  };

  return new FacebookStrategy(strategyActualOptions, verifyCallback);
};

export default configureStrategy;
