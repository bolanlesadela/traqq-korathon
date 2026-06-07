import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateSlug } from '../../utils/helpers.js';
import { TOKEN_EXPIRY } from '../../config/constants.js';

const BCRYPT_ROUNDS = 12;

// ─── TOKEN HELPERS ────────────────────────────────────────────────────────────

/**
 * Sign a short-lived JWT access token.
 * Contains vendor id and email — nothing sensitive.
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

/**
 * Generate a cryptographically random refresh token string.
 * This is what we send to the client.
 * We store only its SHA-256 hash in the DB.
 */
function generateRefreshToken() {
  return randomBytes(64).toString('hex'); // 128-char hex string
}

/**
 * Hash a refresh token before DB storage.
 * SHA-256 is sufficient — tokens are already high-entropy random strings.
 */
function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Persist a refresh token to the DB for the given user.
 * Hashes the token before storing.
 */
async function storeRefreshToken(userId, rawToken, userAgent) {
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH_MS);

  const { error } = await supabase.from('refresh_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    user_agent: userAgent || null,
  });

  if (error) throw new AppError('Failed to store session', 500);
}

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Register a new vendor.
 * Steps:
 *   1. Check email isn't already taken
 *   2. Hash password
 *   3. Generate unique vendor slug
 *   4. Insert user
 *   5. Return tokens immediately (no need for separate login step)
 */
export async function registerVendor({ full_name, email, password, business_name, userAgent }) {
  // 1. Check for existing email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  // 2. Hash password
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 3. Generate slug — retry up to 3 times if collision (extremely rare)
  let vendor_slug;
  const slugBase = business_name || full_name;
  for (let i = 0; i < 3; i++) {
    const candidate = generateSlug(slugBase);
    const { data: slugExists } = await supabase
      .from('users')
      .select('id')
      .eq('vendor_slug', candidate)
      .maybeSingle();

    if (!slugExists) {
      vendor_slug = candidate;
      break;
    }
  }

  if (!vendor_slug) throw new AppError('Could not generate vendor slug. Try again.', 500);

  // 4. Insert user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      full_name,
      email,
      password_hash,
      business_name: business_name || null,
      vendor_slug,
    })
    .select('id, email, full_name, business_name, vendor_slug, currency, korapay_link, created_at')
    .single();

  if (error) throw new AppError('Registration failed. Please try again.', 500);

  // 5. Issue tokens
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, rawRefreshToken, userAgent);

  return {
    user,
    access_token: accessToken,
    refresh_token: rawRefreshToken,
  };
}

/**
 * Login an existing vendor.
 * Steps:
 *   1. Find user by email
 *   2. Compare password against hash
 *   3. Issue fresh token pair
 */
export async function loginVendor({ email, password, userAgent }) {
  // 1. Find user — select password_hash here (only place we ever fetch it)
  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name, business_name, vendor_slug, currency, korapay_link, password_hash, is_active')
    .eq('email', email)
    .maybeSingle();

  // Use the same error for "not found" and "wrong password"
  // Never tell attackers which one it was
  const invalidCredentialsError = new AppError('Invalid email or password', 401);

  if (!user) throw invalidCredentialsError;
  if (!user.is_active) throw new AppError('Account is deactivated. Contact support.', 403);

  // 2. Compare password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) throw invalidCredentialsError;

  // 3. Issue tokens
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, rawRefreshToken, userAgent);

  // Strip password_hash before returning
  const { password_hash, ...safeUser } = user;

  return {
    user: safeUser,
    access_token: accessToken,
    refresh_token: rawRefreshToken,
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Steps:
 *   1. Hash the incoming token, look it up in DB
 *   2. Validate it: exists, not revoked, not expired
 *   3. Rotate: revoke old token, issue new pair
 *
 * Token rotation means a stolen refresh token can only be used once.
 * If an attacker uses it, the real user's next refresh will fail → relogin.
 */
export async function refreshAccessToken({ rawToken, userAgent }) {
  const tokenHash = hashRefreshToken(rawToken);

  // 1. Look up token
  const { data: tokenRecord } = await supabase
    .from('refresh_tokens')
    .select('id, user_id, expires_at, revoked')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!tokenRecord) throw new AppError('Invalid refresh token', 401);
  if (tokenRecord.revoked) throw new AppError('Refresh token has been revoked', 401);
  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  // 2. Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name, business_name, vendor_slug, currency, korapay_link, is_active')
    .eq('id', tokenRecord.user_id)
    .maybeSingle();

  if (!user || !user.is_active) throw new AppError('Account not found or deactivated', 401);

  // 3. Rotate tokens — revoke old, issue new
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('id', tokenRecord.id);

  const newAccessToken = signAccessToken(user);
  const newRawRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, newRawRefreshToken, userAgent);

  return {
    access_token: newAccessToken,
    refresh_token: newRawRefreshToken,
  };
}

/**
 * Logout: revoke the refresh token.
 * Access token expires naturally (15 min) — we can't revoke it,
 * but its short lifespan makes this acceptable.
 */
export async function logoutVendor({ rawToken }) {
  if (!rawToken) return; // already logged out

  const tokenHash = hashRefreshToken(rawToken);

  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('token_hash', tokenHash);
  // Fail silently — if token didn't exist, the user is effectively logged out anyway
}

/**
 * Update vendor's Korapay payment link.
 */
export async function updateKorapayLink({ vendorId, korapay_link }) {
  const { data, error } = await supabase
    .from('users')
    .update({ korapay_link })
    .eq('id', vendorId)
    .select('id, vendor_slug, korapay_link')
    .single();

  if (error) throw new AppError('Failed to update payment link', 500);
  return data;
}

/**
 * Get current vendor profile (safe fields only).
 */
export async function getVendorProfile(vendorId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, business_name, vendor_slug, currency, korapay_link, created_at')
    .eq('id', vendorId)
    .single();

  if (error || !data) throw new AppError('Vendor not found', 404);
  return data;
}
