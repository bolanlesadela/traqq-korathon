import { env } from '../config/env.js';
import { apiResponse } from '../utils/apiResponse.js';
import { ZodError } from 'zod';

/**
 * Global error handler. Must be the LAST middleware registered in app.js.
 * Catches everything — sync errors, async errors (via express-async-errors).
 *
 * Rules:
 * 1. Never leak stack traces to the client in production.
 * 2. Always log the full error server-side.
 * 3. Return consistent error shape via apiResponse.
 */
export function errorHandler(err, req, res, next) {
  // Always log the full error server-side
  console.error(`[ERROR] ${req.method} ${req.path}`, {
    message: err.message,
    stack: env.isDev ? err.stack : undefined,
    statusCode: err.statusCode,
  });

  // Zod validation errors — 400 with field-level detail
  if (err instanceof ZodError) {
    return apiResponse.error(res, {
      message: 'Validation failed',
      statusCode: 400,
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return apiResponse.error(res, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return apiResponse.error(res, {
      message: 'Token expired',
      statusCode: 401,
    });
  }

  // Known operational errors (thrown intentionally in services)
  if (err.isOperational) {
    return apiResponse.error(res, {
      message: err.message,
      statusCode: err.statusCode || 400,
    });
  }

  // Unknown/unexpected errors — never expose details in production
  return apiResponse.error(res, {
    message: env.isProd ? 'Something went wrong' : err.message,
    statusCode: 500,
  });
}

/**
 * Custom operational error class.
 * Throw this for expected errors (wrong password, not found, etc.)
 * vs letting unknown bugs bubble up as 500s.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
