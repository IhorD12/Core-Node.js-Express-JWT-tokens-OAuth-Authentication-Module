// src/auth/strategies/githubStrategy.ts
/**
 * @fileoverview GitHub OAuth 2.0 Strategy Configuration Function.
 * Returns a Passport strategy instance configured for GitHub.
 */
import { Strategy as GithubStrategy, Profile as GithubProfile, StrategyOptions as GithubStrategyOptions } from 'passport-github2';
import { VerifyCallback } from 'passport-oauth2'; // passport-github2 uses oauth2's VerifyCallback
import { ConfiguredOAuthProvider } from '@config/index';
import { UserService } from '@services/userService';
import { AuthService } from '@services/authService';
import { ProviderUserProfile } from '@adapters/userStoreAdapter';
import logger from '@config/logger';

interface StrategyServices {
  userService: UserService;
  authService: AuthService;
}

type GithubStrategyOptionsFromConfig = Pick<
    ConfiguredOAuthProvider['options'],
    'clientID' | 'clientSecret' | 'callbackURL' | 'scope' |
    'authorizationURL' | 'tokenURL' | 'userProfileURL' | 'customHeaders' | 'providerName' // userEmailURL if used
>;

const configureStrategy = (
    options: GithubStrategyOptionsFromConfig,
    services: StrategyServices
): GithubStrategy => {
  const providerName = options.providerName || 'github'; // Fallback

  if (!options.clientID || !options.clientSecret || !options.callbackURL || !options.userProfileURL) {
    const errMsg = `${providerName} strategy requires clientID, clientSecret, callbackURL, and userProfileURL in options.`;
    logger.error(errMsg, { provider: providerName, optionsProvided: Object.keys(options) });
    throw new Error(errMsg);
  }
  if (!services || !services.userService || !services.authService) {
    const errMsg = 'userService and authService must be provided to GitHub strategy.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  // passport-github2 StrategyOptions is a bit different, ensure we map correctly
  const strategyActualOptions: GithubStrategyOptions = {
    clientID: options.clientID,
    clientSecret: options.clientSecret,
    callbackURL: options.callbackURL,
    scope: options.scope as string[] || ['user:email', 'read:user'],
    authorizationURL: options.authorizationURL,
    tokenURL: options.tokenURL,
    userProfileURL: options.userProfileURL,
    // userAgent: options.customHeaders?.['User-Agent'] || 'NodeJsAuthModule/1.0', // passport-github2 might take userAgent directly
    customHeaders: options.customHeaders, // Or pass the whole customHeaders object
    passReqToCallback: false,
  };

  return new GithubStrategy(strategyActualOptions,
    async (
        accessToken: string, // accessToken from GitHub
        providedRefreshToken: string | undefined, // refreshToken from GitHub (typically null)
        profile: GithubProfile,
        done: VerifyCallback
    ) => {
      logger.debug('GitHub Profile received:', { profileId: profile.id, displayName: profile.displayName, username: profile.username });

      try {
        if (!profile || !profile.id) {
          logger.warn('GitHub profile is invalid or missing ID.', { profile });
          return done(new Error("GitHub profile is invalid or missing ID."));
        }

        // `userService.findOrCreateUser` expects a raw PassportProfile
        const user = await services.userService.findOrCreateUser(profile, 'github');
        if (!user) {
          logger.error('Failed to find or create user from GitHub profile.', { profile });
          return done(new Error("Could not find or create user from GitHub profile."));
        }

        const { accessToken: appAccessToken, refreshToken: appRefreshToken } =
            await services.authService.generateAndStoreAuthTokens(user);

        logger.info('OAuth login successful and tokens issued', { userId: user.id, provider: providerName });
        return done(null, { user, accessToken: appAccessToken, refreshToken: appRefreshToken });

      } catch (error: any) {
        logger.warn('OAuth authentication failed during user processing', {
            provider: providerName,
            userIdFromProfile: profile ? profile.id : 'unknown',
            error: error.message,
            stack: error.stack
        });
        return done(error);
      }
    }
  );
};

export default configureStrategy;
