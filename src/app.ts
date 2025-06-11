// src/app.ts
/**
 * @fileoverview Main application file for the Express server.
 * Initializes the app, sets up middleware, routes, and error handling.
 */
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
// Remove old rate-limit import: import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import passport from 'passport'; // Passport instance
import path from 'path';
import fs from 'fs';
import YAML from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser'; // Import cookie-parser

import config from '@config/index'; // Path alias
import logger from '@config/logger'; // Path alias
import { generalAuthLimiter, createRateLimiterMiddleware } from '@config/rateLimiters'; // New import
import initializePassport from '@src/auth/passportSetup'; // Path alias for passport setup
import authRoutes from '@routes/authRoutes'; // Path alias
import profileRoutes from '@routes/profileRoutes'; // Path alias
import healthRoutes from '@routes/healthRoutes'; // Path alias

const app: Application = express();

// --- Pre-Middleware Setup ---
logger.info(`App running in ${config.nodeEnv} mode. Log level: ${logger.level}`);

// --- Core Middleware ---

// HTTP to HTTPS Redirect (Production only)
// Should be placed before Helmet if it might interfere with HSTS, or early in general.
if (config.nodeEnv === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const protocol = req.headers['x-forwarded-proto'] as string || req.protocol;
    if (protocol !== 'https') {
      logger.info(`Redirecting HTTP to HTTPS: ${req.method} ${req.hostname}${req.url}`);
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// Helmet Security Headers
if (config.nodeEnv === 'production') {
  app.use(helmet({
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: false, // Set to true if you understand the implications and are ready to submit
    },
    // Example: Disable Content-Security-Policy if not explicitly configured, to avoid breakage.
    // contentSecurityPolicy: false,
    // Or configure it:
    // contentSecurityPolicy: {
    //   directives: {
    //     defaultSrc: ["'self'"],
    //     scriptSrc: ["'self'", "trusted-cdn.com"],
    //   },
    // },
  }));
  logger.info('Helmet configured with HSTS for production.');
} else {
  app.use(helmet({
    hsts: false, // Disable HSTS in non-production to avoid caching issues during dev
  }));
  logger.info('Helmet configured (HSTS disabled for non-production).');
}

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || (config.corsAllowedOrigins && config.corsAllowedOrigins.indexOf(origin) !== -1)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Apply new general auth rate limiter from rate-limiter-flexible
app.use('/auth', createRateLimiterMiddleware(generalAuthLimiter));

app.use(cookieParser()); // Use cookie-parser middleware

// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// --- Passport Configuration ---
initializePassport(app); // Pass Express app instance

// --- Swagger/OpenAPI Documentation ---
try {
  const openApiPath = path.join(__dirname, '../../docs/openapi.yaml');
  if (fs.existsSync(openApiPath)) {
    const swaggerDocument: any = YAML.load(fs.readFileSync(openApiPath, 'utf8')); // Type as any if structure is complex/unknown
    // const swaggerOptions = { /* ... */ };
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument /*, swaggerOptions*/));
    logger.info('Swagger UI setup at /api-docs, serving from docs/openapi.yaml');
  } else {
    logger.warn('docs/openapi.yaml not found. Swagger UI will not be available.');
  }
} catch (e: any) {
  logger.error('Failed to load or parse openapi.yaml for Swagger UI:', { message: e.message, stack: e.stack });
}

// --- Application Routes ---
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/auth', profileRoutes); // Mounts profile routes under /auth (e.g. /auth/profile, /auth/admin/dashboard)

// --- Basic Welcome Route ---
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Modular Authentication API!' });
});

// --- Error Handling Middleware ---
// Catch-all for 404 Not Found errors
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ message: 'Resource not found.' });
});

// Generic error handler (should be last middleware)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    status: err.status // Include status if available on error object
  });

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred.';

  // Avoid sending stack in production for errors that are not operational
  const errorDetails = config.nodeEnv === 'development' && err.stack ? { errorDetails: err.stack } : {};

  res.status(statusCode).json({
    message: message,
    ...errorDetails,
  });
});

export default app;
