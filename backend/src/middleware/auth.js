import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { supabase } from '../config/supabase.js';

/**
 * JWT authentication middleware.
 *
 * Validates the Bearer token in the Authorization header.
 * On success, attaches req.user = { id, email } for downstream use.
 * On failure, throws — caught by errorHandler → 401.
 *
 * We do a lightweight DB check to confirm the user still exists
 * and is active. This costs one DB query per request but prevents
 * deactivated accounts from continuing to use valid tokens.
 *
 * Trade-off: for high-traffic endpoints, you could skip the DB check
 * and rely solely on token expiry. For Traqq's scale, the extra
 * security is worth it.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization token required', 401);
  }

  const token = authHeader.split(' ')[1];

  // Verify signature and expiry — throws JsonWebTokenError or TokenExpiredError
  // These are caught by the global errorHandler
  const decoded = jwt.verify(token, env.jwt.accessSecret);

  // Confirm user still exists and is active
  const { data: user } = await supabase
    .from('users')
    .select('id, email, is_active')
    .eq('id', decoded.sub)
    .maybeSingle();

  if (!user || !user.is_active) {
    throw new AppError('Account not found or deactivated', 401);
  }

  // Attach to request — controllers and services use req.user.id
  req.user = { id: user.id, email: user.email };

  next();
}
