import { env } from '../config/env.js';

/**
 * Simple request logger.
 * Logs: method, path, status code, response time.
 * Skips logging in test environment.
 */
export function requestLogger(req, res, next) {
  if (env.nodeEnv === 'test') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 500
      ? '\x1b[31m'   // red
      : res.statusCode >= 400
        ? '\x1b[33m' // yellow
        : '\x1b[32m'; // green
    const reset = '\x1b[0m';

    console.log(
      `${statusColor}${res.statusCode}${reset} ${req.method} ${req.originalUrl} — ${duration}ms`
    );
  });

  next();
}
