// src/config/rateLimiters.ts
import { RateLimiterMemory, RateLimiterRes, IRateLimiterOptions } from 'rate-limiter-flexible';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '@config/logger'; // Path alias
import config from '@config/index'; // Path alias for main config (nodeEnv)

// Options for a general limiter for most auth routes
const generalAuthLimiterOpts: IRateLimiterOptions = {
  points: config.nodeEnv === 'test' ? 3 : 20, // Test: 3 requests
  duration: config.nodeEnv === 'test' ? 5 : 15 * 60, // Test: per 5 seconds
  blockDuration: config.nodeEnv === 'test' ? 10 : 10 * 60, // Test: block for 10 seconds
  keyPrefix: 'auth_general_testable', // Changed prefix to avoid collision with previous if not cleared
};
export const generalAuthLimiter = new RateLimiterMemory(generalAuthLimiterOpts);

// Options for a stricter limiter for sensitive operations like token refresh, 2FA verify
const sensitiveOperationLimiterOpts: IRateLimiterOptions = {
  points: config.nodeEnv === 'test' ? 2 : 5, // Test: 2 requests
  duration: config.nodeEnv === 'test' ? 5 : 15 * 60, // Test: per 5 seconds
  blockDuration: config.nodeEnv === 'test' ? 10 : 30 * 60, // Test: block for 10 seconds
  keyPrefix: 'auth_sensitive_testable', // Changed prefix
};
export const sensitiveOperationLimiter = new RateLimiterMemory(sensitiveOperationLimiterOpts);

/**
 * Creates an Express middleware function for rate limiting.
 * @param {RateLimiterMemory} limiter - An instance of RateLimiterMemory.
 * @param {boolean} [consumePointsOnFailureOnly=false] - Placeholder for future advanced logic.
 * @returns {RequestHandler} Express middleware function.
 */
export const createRateLimiterMiddleware = (
  limiter: RateLimiterMemory,
  consumePointsOnFailureOnly = false // Currently a placeholder
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip; // Or req.ips[0] if behind a trusted proxy like Nginx, Heroku, AWS ELB, etc.
                    // Ensure Express 'trust proxy' setting is configured if using req.ips[0].

    if (consumePointsOnFailureOnly) {
      // This functionality is not fully implemented in this basic middleware.
      // To implement this, the middleware would need to:
      // 1. Not call limiter.consume() here.
      // 2. Attach the limiter and IP to `req` (e.g., req.rateLimiter = limiter; req.rateLimiterIp = ip).
      // 3. Route handlers, upon detecting a "failure" (e.g., bad login, invalid 2FA token),
      //    would then call `await req.rateLimiter.consume(req.rateLimiterIp, 1);`
      //    This is more complex and ties rate limiting logic into route handlers.
      // For now, we log and proceed with default consumption on each request.
      logger.debug('Rate limiter configured for consumePointsOnFailureOnly, but current middleware version consumes on each request.', { path: req.path });
    }

    try {
      await limiter.consume(ip, 1); // Consume 1 point per request
      next();
    } catch (rlResOrErr) {
      if (rlResOrErr instanceof Error) {
        // An internal error occurred within the rate-limiter-flexible library itself
        logger.error('Rate limiter internal error:', { error: rlResOrErr.message, stack: rlResOrErr.stack, ip, path: req.path });
        // It's important not to block the user for an internal error, but to log it and potentially alert.
        // Depending on policy, you might allow the request or send a generic server error.
        // For now, let's pass it to the global error handler.
        return next(rlResOrErr);
      }

      // If it's a RateLimiterRes object, it means the rate limit was exceeded
      const rateLimiterResponse = rlResOrErr as RateLimiterRes;
      const retryAfter = Math.ceil(rateLimiterResponse.msBeforeNext / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      logger.warn('Rate limit exceeded for IP:', { ip, path: req.path, retryAfter });
      res.status(429).json({
        message: `Too many requests. Please try again after ${retryAfter} seconds.`,
        retryAfter,
      });
    }
  };
};
