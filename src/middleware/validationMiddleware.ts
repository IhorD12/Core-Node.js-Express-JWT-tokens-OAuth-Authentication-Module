// src/middleware/validationMiddleware.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Schema } from 'joi'; // Import Schema type from Joi
import logger from '@config/logger'; // Path alias

/**
 * @fileoverview Generic middleware for validating request bodies using Joi schemas.
 */

interface ValidationErrorDetail {
  message: string;
  path: string;
  type?: string;
}

interface ValidationResponseBody {
  message: string;
  errors: ValidationErrorDetail[];
}

/**
 * Creates an Express middleware function to validate the request body against a given Joi schema.
 * If validation fails, it sends a 400 response with error details.
 * If validation succeeds, it calls the next middleware and can replace `req.body` with the
 * validated (and potentially type-casted/defaulted) value if `stripUnknown` is used differently in schema.
 *
 * @param {Schema} schema - The Joi schema to validate `req.body` against.
 * @returns {RequestHandler} Express middleware function.
 */
export const validateRequestBody = (schema: Schema): RequestHandler => {
  return (req: Request, res: Response<ValidationResponseBody | { message: string }>, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first
      allowUnknown: true, // By default, allow unknown keys (schema's .unknown(true) takes precedence if set)
      stripUnknown: false, // Do not remove unknown keys from req.body by default
                           // Set to true in Joi.object().options({stripUnknown: true}) if desired.
    });

    if (error) {
      const errors: ValidationErrorDetail[] = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path.join('.'),
        type: detail.type,
      }));
      logger.warn('Request body validation failed:', {
        errors,
        body: req.body, // Log original body for debugging
        path: req.originalUrl,
        ip: req.ip
      });
      return res.status(400).json({
        message: 'Validation failed.',
        errors,
      });
    }

    // Important: Assign the validated (and potentially transformed/defaulted) value back to req.body.
    // This ensures subsequent handlers use the validated data, which might include type conversions by Joi.
    req.body = value;
    next();
  };
};
