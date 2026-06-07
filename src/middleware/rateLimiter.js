import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { apiResponse } from '../utils/apiResponse.js';

const handler = (req, res) => {
  apiResponse.error(res, {
    message: 'Too many requests. Please slow down.',
    statusCode: 429,
  });
};

/**
 * Strict limiter for auth endpoints.
 * 10 requests per 15 minutes per IP.
 * Prevents brute force on login/register.
 */
export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxAuth,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General limiter for protected API routes.
 * 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxGeneral,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Redirect limiter for /pay/:vendorSlug.
 * More generous — real customers clicking payment links.
 */
export const redirectLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Webhook limiter — Korapay should not be sending more than this.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});
