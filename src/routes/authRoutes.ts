// src/routes/authRoutes.ts
import { Router, Response, NextFunction, Request } from 'express';
import passport from 'passport';
import config from '@config/index'; // Path alias
import authService from '@services/authService'; // Path alias
import logger from '@config/logger'; // Path alias
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import { AuthCallbackData, RefreshTokenRequestBody, LogoutRequestBody } from '@src/types/auth.d'; // Path alias
import { verifyToken } from '@middleware/authMiddleware'; // For protecting 2FA routes
import twoFactorAuthService, { TwoFactorSetupResponse } from '@services/twoFactorAuthService'; // Import 2FA service

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

    /**
     * @route GET /auth/:providerName
     * @description Initiates OAuth 2.0 authentication flow for the specified provider.
     */
    router.get(
      `/${provider.name}`,
      passport.authenticate(provider.name, {
        scope: provider.options.scope,
        session: false,
        ...(provider.options.customParams || {})
      })
    );

    /**
     * @route GET /auth/:providerName/callback
     * @description Handles the callback from the OAuth provider after authentication.
     */
    router.get(
      `/${provider.name}/callback`,
      (req: Request, res: Response, next: NextFunction) => { // Standard Request type here initially
        passport.authenticate(
          provider.name,
          { session: false, failureRedirect: '/auth/login-failure' }, // failureRedirect assumes /auth prefix from app.js
          (err: any, data: AuthCallbackData | false, info: any) => {
            if (err) {
              logger.error(`${provider.name} OAuth callback error:`, { provider: provider.name, error: err.message, stack: err.stack });
              return res.status(500).json({
                message: `Authentication failed during ${provider.name} callback.`,
                error: err.message,
              });
            }
            if (!data || !data.accessToken) {
              const message = (info && info.message)
                ? info.message
                : `Authentication failed. No access token received from ${provider.name} strategy.`;
              logger.warn(`${provider.name} OAuth callback - no access token:`, { provider: provider.name, info });
              return res.status(401).json({ message });
            }
            res.json({
              message: `${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} authentication successful!`,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: data.user,
            });
          }
        )(req, res, next);
      }
    );
  });
}


/**
 * @route GET /auth/login-failure
 * @description A conceptual route for handling OAuth login failures.
 */
router.get('/login-failure', (req: Request, res: Response) => {
  res.status(401).json({ message: 'OAuth authentication failed. Please try again.' });
});


/**
 * @route POST /auth/refresh
 * @description Renews an access token using a valid refresh token.
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => { // Standard Request
  const { refreshToken: providedRefreshToken } = req.body as RefreshTokenRequestBody;

  if (!providedRefreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAuthTokens(providedRefreshToken);
    res.json({
      message: 'Tokens refreshed successfully.',
      accessToken: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    if (error.status) { // Check for custom AuthError status
      return res.status(error.status).json({ message: error.message });
    }
    // Handle specific JWT errors that authService might re-throw or not catch
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

/**
 * @route POST /auth/logout
 * @description Invalidates a refresh token.
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => { // Standard Request
  const { refreshToken: providedRefreshToken } = req.body as LogoutRequestBody;

  if (!providedRefreshToken) {
    return res.status(400).json({ message: 'Refresh token is required to logout.' });
  }

  try {
    const removed = await authService.logoutUser(providedRefreshToken);
    if (removed) {
      res.status(200).json({ message: 'Logout successful. Refresh token invalidated.' });
    } else {
      res.status(200).json({ message: 'Logout successful or token already invalidated.' });
    }
  } catch (error: any) {
    if (error.status) { // Check for custom AuthError status
        return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token format.' });
    }
    logger.error('Error during logout:', { message: error.message, stack: error.stack });
    return res.status(500).json({ message: 'Could not process logout.' });
  }
});


// --- Two-Factor Authentication Routes ---

/**
 * @route POST /auth/2fa/setup
 * @description Initiates 2FA setup for the authenticated user.
 * @access Private (Authenticated)
 */
router.post('/2fa/setup', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) { // Should be caught by verifyToken, but good practice
      return res.status(401).json({ message: 'User not authenticated.' });
    }
    const setupInfo: TwoFactorSetupResponse = await twoFactorAuthService.setup(req.user);
    res.json(setupInfo);
  } catch (error: any) {
    logger.error('2FA setup error:', { userId: req.user?.id, message: error.message, stack: error.stack });
    next(error); // Pass to global error handler
  }
});

/**
 * @route POST /auth/2fa/verify
 * @description Verifies a TOTP token to enable 2FA or as a second factor.
 * @access Private (Authenticated)
 * @body { "token": "string" }
 */
router.post('/2fa/verify', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { token } = req.body;
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }
  if (!token) {
    return res.status(400).json({ message: 'TOTP token is required.' });
  }

  try {
    const isValid = await twoFactorAuthService.verifyToken(req.user, token as string);
    if (isValid) {
      // If this was the first verification after setup, the service method would have set isTwoFactorEnabled = true.
      res.json({ message: '2FA token verified successfully.' }); // Or '2FA enabled successfully.'
    } else {
      res.status(400).json({ message: 'Invalid 2FA token.' });
    }
  } catch (error: any) {
    logger.error('2FA verification error:', { userId: req.user.id, message: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @route POST /auth/2fa/disable
 * @description Disables 2FA for the authenticated user.
 * @access Private (Authenticated)
 * @body { "token": "string" } (Optional: might require current TOTP or password for disabling)
 */
router.post('/2fa/disable', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // const { currentTokenOrPassword } = req.body; // Optional: verify current access before disabling
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  try {
    await twoFactorAuthService.disable(req.user);
    res.json({ message: '2FA disabled successfully.' });
  } catch (error: any) {
    logger.error('2FA disable error:', { userId: req.user.id, message: error.message, stack: error.stack });
    next(error);
  }
});


export default router;
