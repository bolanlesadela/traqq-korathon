import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a URL-safe vendor slug from their business name.
 * e.g. "Adaeze Fashion Store" → "adaeze-fashion-store"
 * Appends random suffix to guarantee uniqueness.
 */
export function generateSlug(businessName) {
  const base = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .substring(0, 30);               // max 30 chars for base

  const suffix = Math.random().toString(36).substring(2, 7); // 5 char random
  return `${base}-${suffix}`;
}

/**
 * Generate a unique session ID for click-to-payment attribution.
 * This UUID bridges the click record and the webhook payment record.
 */
export function generateSessionId() {
  return uuidv4();
}

/**
 * Hash an IP address before storing.
 * We never store raw IPs — privacy by design.
 * SHA-256 is enough for deduplication without reversibility.
 */
export function hashIp(ip) {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Extract real IP from request, handling proxies.
 */
export function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}
