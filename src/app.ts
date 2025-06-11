// src/app.ts
/**
 * @fileoverview Main application file for the Express server.
 * Initializes the app, sets up middleware, routes, and error handling.
 */
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit'; // Import specific type if available
import passport from 'passport'; // Passport instance
import path from 'path';
import fs from 'fs';
import YAML from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

import config from '@config/index'; // Path alias
import logger from '@config/logger'; // Path alias
import initializePassport from '@src/auth/passportSetup'; // Path alias for passport setup
import authRoutes from '@routes/authRoutes'; // Path alias
import profileRoutes from '@routes/profileRoutes'; // Path alias
import healthRoutes from '@routes/healthRoutes'; // Path alias

const app: Application = express();

// --- Pre-Middleware Setup ---
logger.info(`App running in ${config.nodeEnv} mode. Log level: ${logger.level}`);

// --- Core Middleware ---
app.use(helmet()); // Default Helmet security headers

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

// Rate Limiting for Authentication Routes
const authRateLimiter: RateLimitRequestHandler = rateLimit({ // Use specific type if available from @types/express-rate-limit
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP for auth routes, please try again after 15 minutes.' },
});
app.use('/auth', authRateLimiter);

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
