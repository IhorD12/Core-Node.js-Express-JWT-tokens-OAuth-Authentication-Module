// src/auth/strategies/googleStrategy.ts
/**
 * @fileoverview Google OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for Google.
 */
import { Strategy as GoogleStrategy, Profile as GoogleProfile, StrategyOptions } from 'passport-google-oauth20';
import { VerifyCallback } from 'passport-oauth2'; // Commonly used, or specific to google if available
import { ConfiguredOAuthProvider } from '@config/index'; // Assuming this type will be defined or part of Config
import { UserService } from '@services/userService'; // Assuming services export types
import { AuthService } from '@services/authService';
import { ProviderUserProfile } from '@adapters/userStoreAdapter';
import logger from '@config/logger';

// Interface for the services expected by this strategy
interface StrategyServices {
  userService: UserService;
  authService: AuthService;
}

// Options for GoogleStrategy, derived from what ConfiguredOAuthProvider.options provides
// passport-google-oauth20's StrategyOptions already covers clientID, clientSecret, callbackURL, scope, etc.
// We just need to ensure our ConfiguredOAuthProvider.options match this or are adapted.
type GoogleStrategyOptionsFromConfig = Pick<
    ConfiguredOAuthProvider['options'],
    'clientID' | 'clientSecret' | 'callbackURL' | 'scope' | 'authorizationURL' | 'tokenURL' | 'userProfileURL'
>;


const configureStrategy = (
    options: GoogleStrategyOptionsFromConfig,
    services: StrategyServices
): GoogleStrategy => {
  if (!options.clientID || !options.clientSecret || !options.callbackURL || !options.userProfileURL) {
    const errMsg = 'Google Strategy: Missing critical options (clientID, clientSecret, callbackURL, userProfileURL).';
    logger.error(errMsg, { optionsProvided: Object.keys(options) });
    throw new Error(errMsg);
  }
  if (!services || !services.userService || !services.authService) {
    const errMsg = 'userService and authService must be provided to Google strategy.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  // Construct the options for GoogleStrategy, ensuring all required fields are present
  const strategyActualOptions: StrategyOptions = {
    clientID: options.clientID,
    clientSecret: options.clientSecret,
    callbackURL: options.callbackURL,
    scope: options.scope as string[], // Assuming scope is string[]
    authorizationURL: options.authorizationURL,
    tokenURL: options.tokenURL,
    userProfileURL: options.userProfileURL,
    passReqToCallback: false, // Explicitly false
  };

  return new GoogleStrategy(strategyActualOptions,
    async (
        accessToken: string, // accessToken from Google
        providedRefreshToken: string | undefined, // refreshToken from Google (if any)
        profile: GoogleProfile,
        done: VerifyCallback
    ) => {
      logger.debug('Google Profile received', { profileId: profile.id, displayName: profile.displayName });

      try {
        if (!profile || !profile.id) {
          logger.warn('Google profile is invalid or missing ID.', { profile });
          return done(new Error("Google profile is invalid or missing ID."));
        }

        const userProfileDetails: ProviderUserProfile = {
          provider: 'google',
          providerId: profile.id,
          displayName: profile.displayName || `GoogleUser-${profile.id}`,
          email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
          photo: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
          _json: profile._json,
        };

        const user = await services.userService.findOrCreateUser(profile, 'google'); // passportProfile, providerName
        if (!user) {
          logger.error('Failed to find or create user from Google profile.', { userProfileDetails });
          return done(new Error("Could not find or create user from Google profile."));
        }

        const { accessToken: appAccessToken, refreshToken: appRefreshToken } =
            await services.authService.generateAndStoreAuthTokens(user);

        // Pass an object containing our app-specific tokens and user profile to the callback
        return done(null, { user, accessToken: appAccessToken, refreshToken: appRefreshToken });

      } catch (error: any) {
        logger.error('Error in Google Strategy verification callback:', { message: error.message, stack: error.stack });
        return done(error);
      }
    }
  );
};

// Exporting the function directly as expected by passportSetup.ts
export default configureStrategy;
