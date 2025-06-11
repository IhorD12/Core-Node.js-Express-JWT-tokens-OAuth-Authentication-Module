// src/routes/authRoutes.ts
import { Router, Response, NextFunction, Request } from 'express';
import passport from 'passport';
import config from '@config/index'; // Path alias
import authService from '@services/authService'; // Path alias
import logger from '@config/logger'; // Path alias
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import { AuthCallbackData, RefreshTokenRequestBody, LogoutRequestBody } from '@src/types/auth.d'; // Path alias
import { verifyToken } from '@middleware/authMiddleware'; // For protecting 2FA routes
import { validateRequestBody } from '@src/middleware/validationMiddleware'; // Path alias
import { refreshTokenSchema, logoutTokenSchema, twoFactorVerifySchema } from '@src/validators/authValidators'; // Path alias
import twoFactorAuthService, { TwoFactorSetupResponse } from '@services/twoFactorAuthService'; // Import 2FA service
import { sensitiveOperationLimiter, createRateLimiterMiddleware } from '@config/rateLimiters'; // Import new rate limiters

const router = Router();

/**
 * @fileoverview Dynamically generates OAuth authentication routes.
 * Also includes fixed routes for token refresh, logout, and login failure.
 */

// Dynamically create OAuth initiation and callback routes
if (config.oauthProviders && Array.isArray(config.oauthProviders)) {
  config.oauthProviders.forEach(provider => {
    if (!provider.name || !provider.authPath || !provider.callbackPath || !provider.options) {
      logger.warn(`Skipping invalid OAuth provider configuration: ${JSON.stringify(provider)}`);
      return;
    }

    logger.info(`Creating OAuth routes for provider: ${provider.name}`);

    router.get(
      `/${provider.name}`,
      passport.authenticate(provider.name, {
        scope: provider.options.scope,
        session: false,
        ...(provider.options.customParams || {})
      })
    );

    router.get(
      `/${provider.name}/callback`,
      (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate(
          provider.name,
          { session: false, failureRedirect: '/auth/login-failure' },
          (err: any, data: AuthCallbackData | false, info: any) => {
            if (err) {
              logger.error(`${provider.name} OAuth callback error:`, { provider: provider.name, error: err.message, stack: err.stack });
              return res.status(500).json({
                message: `Authentication failed during ${provider.name} callback.`,
                error: err.message,
              });
            }
            if (!data || !data.accessToken || !data.refreshToken) { // Check for both tokens
              const message = (info && info.message)
                ? info.message
                : `Authentication failed. No tokens received from ${provider.name} strategy.`;
              logger.warn(`${provider.name} OAuth callback - no tokens:`, { provider: provider.name, info });
              return res.status(401).json({ message });
            }

            // Set refresh token in HTTP-only cookie
            res.cookie(config.refreshTokenCookieName, data.refreshToken, {
              httpOnly: true,
              secure: config.nodeEnv === 'production',
              sameSite: config.refreshTokenCookieSameSite,
              path: '/auth', // Accessible to /auth/refresh, /auth/logout
              maxAge: config.refreshTokenCookieMaxAge,
            });

            res.json({
              message: `${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} authentication successful!`,
              accessToken: data.accessToken,
              // refreshToken: data.refreshToken, // Optionally omit from body if cookie is primary
              user: data.user,
            });
          }
        )(req, res, next);
      }
    );
  });
}

router.get('/login-failure', (req: Request, res: Response) => {
  res.status(401).json({ message: 'OAuth authentication failed. Please try again.' });
});

router.post(
  '/refresh',
  createRateLimiterMiddleware(sensitiveOperationLimiter), // Apply sensitive operation limiter
  validateRequestBody(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
  // req.body is validated, can be used directly if types align with RefreshTokenRequestBody
  // or cast if Joi output 'value' is assigned back and has specific type.
  // For this setup, Joi value is assigned back, so req.body is the validated object.
  let providedRefreshToken = req.cookies[config.refreshTokenCookieName];

  if (!providedRefreshToken && req.body && req.body.refreshToken) {
    logger.debug('Refresh token not in cookie, using token from body.');
    providedRefreshToken = (req.body as RefreshTokenRequestBody).refreshToken;
  }

  if (!providedRefreshToken) {
    return res.status(400).json({ message: 'Refresh token is required (in cookie or body).' });
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAuthTokens(providedRefreshToken, req.ip);

    res.cookie(config.refreshTokenCookieName, newRefreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.refreshTokenCookieSameSite,
      path: '/auth',
      maxAge: config.refreshTokenCookieMaxAge,
    });

    res.json({
      message: 'Tokens refreshed successfully.',
      accessToken: accessToken,
      // refreshToken: newRefreshToken, // Optionally omit from body
    });
  } catch (error: any) {
    // Clear cookie if refresh token is invalid/expired and was provided via cookie
    if (req.cookies[config.refreshTokenCookieName] && (error.status === 401 || error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError')) {
        res.cookie(config.refreshTokenCookieName, '', {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: config.refreshTokenCookieSameSite,
            path: '/auth',
            expires: new Date(0),
        });
    }
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }
    logger.error('Error during token refresh:', { message: error.message, stack: error.stack });
    return res.status(500).json({ message: 'Could not refresh token.' });
  }
});

router.post(
  '/logout',
  validateRequestBody(logoutTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
  let providedRefreshToken = req.cookies[config.refreshTokenCookieName];

  if (!providedRefreshToken && req.body && req.body.refreshToken) {
    logger.debug('Logout: Refresh token not in cookie, using token from body.');
    providedRefreshToken = (req.body as LogoutRequestBody).refreshToken;
  }

  // Clear cookie regardless of whether token was found in store or valid, as client wants to logout
  res.cookie(config.refreshTokenCookieName, '', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.refreshTokenCookieSameSite,
    path: '/auth',
    expires: new Date(0),
  });

  if (!providedRefreshToken) {
    // If no token anywhere, still a "successful" logout from client perspective
    return res.status(200).json({ message: 'Logout successful. No active refresh token session to invalidate.' });
  }

  try {
    await authService.logoutUser(providedRefreshToken, req.ip);
    // Message implies server-side invalidation success or that it was already invalid
    res.status(200).json({ message: 'Logout successful. Refresh token invalidated or was already inactive.' });
  } catch (error: any) {
    // Even if logoutUser fails (e.g. malformed token from body), cookie is cleared.
    // This error primarily reflects issues with the token from body if cookie wasn't present.
    if (error.status) {
        return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token format provided for logout.' });
    }
    logger.error('Error during logout processing:', { message: error.message, stack: error.stack });
    // Don't send 500 for logout if cookie clear was main goal for client.
    // But if token from body was processed and failed, it's a specific error.
    res.status(200).json({ message: 'Logout processed. Token from body might have been invalid.' });
  }
});


// --- Two-Factor Authentication Routes ---
// ... (2FA routes remain unchanged for this subtask) ...
router.post('/2fa/setup', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }
    // setup doesn't take clientIp as it's user-initiated for their own account, less of a security log focus for IP for this action.
    const setupInfo: TwoFactorSetupResponse = await twoFactorAuthService.setup(req.user);
    res.json(setupInfo);
  } catch (error: any) {
    logger.error('2FA setup error:', { userId: req.user?.id, ip: req.ip, message: error.message, stack: error.stack });
    next(error);
  }
});

router.post('/2fa/verify', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { token } = req.body;
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }
  if (!token) {
    return res.status(400).json({ message: 'TOTP token is required.' });
  }

  try {
    const isValid = await twoFactorAuthService.verifyToken(req.user, token as string, req.ip);
    if (isValid) {
      res.json({ message: '2FA token verified successfully.' });
    } else {
      res.status(400).json({ message: 'Invalid 2FA token.' });
    }
  } catch (error: any) {
    logger.error('2FA verification error:', { userId: req.user.id, ip: req.ip, message: error.message, stack: error.stack });
    next(error);
  }
});

router.post('/2fa/disable', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  try {
    await twoFactorAuthService.disable(req.user, req.ip);
    res.json({ message: '2FA disabled successfully.' });
  } catch (error: any) {
    logger.error('2FA disable error:', { userId: req.user.id, ip: req.ip, message: error.message, stack: error.stack });
    next(error);
  }
});


export default router;
