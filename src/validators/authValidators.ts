// src/validators/authValidators.ts
import Joi from 'joi';

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    'string.base': 'Refresh token must be a string',
    'string.empty': 'Refresh token is not allowed to be empty',
    'any.required': 'Refresh token is required',
  }),
  // Allow other fields to be present but not validated
}).unknown(true);

export const logoutTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    'string.base': 'Refresh token must be a string',
    'string.empty': 'Refresh token is not allowed to be empty',
    'any.required': 'Refresh token is required',
  }),
}).unknown(true);

// Schema for 2FA token verification
export const twoFactorVerifySchema = Joi.object({
  token: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
    'string.base': '2FA token must be a string',
    'string.empty': '2FA token is not allowed to be empty',
    'string.length': '2FA token must be 6 digits long',
    'string.pattern.base': '2FA token must only contain digits',
    'any.required': '2FA token is required',
  }),
}).unknown(true);
