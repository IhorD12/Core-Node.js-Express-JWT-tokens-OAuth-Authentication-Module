// src/routes/healthRoutes.ts
/**
 * @fileoverview Health check endpoint.
 */
import { Router, Request, Response } from 'express';
import logger from '@config/logger'; // Path alias

const router = Router();

interface HealthCheckResponse {
  uptime: number;
  message: string;
  timestamp: number;
}

/**
 * @route GET /health
 * @description Basic health check endpoint to verify the API is running.
 * @access Public
 */
router.get('/', (req: Request, res: Response<HealthCheckResponse>) => {
  const healthCheck: HealthCheckResponse = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  };
  try {
    // logger.info('Health check successful.'); // Can be too verbose for frequent checks
    res.status(200).json(healthCheck);
  } catch (e: any) {
    const errorHealthCheck: HealthCheckResponse = {
        ...healthCheck,
        message: e.message || 'Error performing health check'
    };
    logger.error('Health check failed:', { message: e.message, stack: e.stack });
    res.status(500).json(errorHealthCheck);
  }
});

export default router;
