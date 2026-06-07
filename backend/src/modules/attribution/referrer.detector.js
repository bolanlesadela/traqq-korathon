import { PLATFORMS } from '../../config/constants.js';

/**
 * Platform detection from HTTP Referer header and User-Agent.
 *
 * Returns one of: instagram | tiktok | facebook | x | whatsapp | unknown
 *
 * Confidence levels:
 *   HIGH   — referrer domain is unambiguous (instagram.com, tiktok.com)
 *   MEDIUM — referrer shim/redirect domain (l.instagram.com, t.co)
 *   LOW    — inferred from User-Agent with empty referrer (WhatsApp)
 *   NONE   — unknown, store as 'unknown'
 *
 * Why we store raw_referrer too:
 * Platform detection logic will improve over time. Storing the raw
 * value lets us re-classify old clicks without losing data.
 */

// Referrer patterns ordered by specificity — most specific first
const REFERRER_PATTERNS = [
  // ── INSTAGRAM ─────────────────────────────────────────────
  { pattern: /instagram\.com/i,         platform: PLATFORMS.INSTAGRAM },
  { pattern: /l\.instagram\.com/i,      platform: PLATFORMS.INSTAGRAM }, // link shim
  { pattern: /lm\.instagram\.com/i,     platform: PLATFORMS.INSTAGRAM }, // link manager

  // ── TIKTOK ────────────────────────────────────────────────
  { pattern: /tiktok\.com/i,            platform: PLATFORMS.TIKTOK },
  { pattern: /snssdk\.com/i,            platform: PLATFORMS.TIKTOK },    // TikTok SDK domain
  { pattern: /musical\.ly/i,            platform: PLATFORMS.TIKTOK },    // old TikTok domain

  // ── FACEBOOK ──────────────────────────────────────────────
  { pattern: /facebook\.com/i,          platform: PLATFORMS.FACEBOOK },
  { pattern: /fb\.me/i,                 platform: PLATFORMS.FACEBOOK },
  { pattern: /m\.facebook\.com/i,       platform: PLATFORMS.FACEBOOK },
  { pattern: /l\.facebook\.com/i,       platform: PLATFORMS.FACEBOOK },  // link shim

  // ── X (TWITTER) ───────────────────────────────────────────
  { pattern: /twitter\.com/i,           platform: PLATFORMS.X },
  { pattern: /x\.com/i,                 platform: PLATFORMS.X },
  { pattern: /t\.co/i,                  platform: PLATFORMS.X },         // Twitter link shortener

  // ── WHATSAPP ──────────────────────────────────────────────
  // WhatsApp rarely sends a referrer — native app strips it.
  // We catch the rare cases where it leaks.
  { pattern: /whatsapp\.com/i,          platform: PLATFORMS.WHATSAPP },
  { pattern: /wa\.me/i,                 platform: PLATFORMS.WHATSAPP },
];

// User-Agent fragments that hint at WhatsApp's in-app browser
// Used when referrer is empty — low confidence but better than 'unknown'
const WHATSAPP_UA_PATTERNS = [
  /whatsapp/i,
  /WhatsApp/,
];

/**
 * Detect platform from referrer URL and User-Agent string.
 *
 * @param {string|null} referrer - HTTP Referer header value
 * @param {string|null} userAgent - HTTP User-Agent header value
 * @returns {{ platform: string, confidence: 'high'|'medium'|'low'|'none' }}
 */
export function detectPlatform(referrer, userAgent) {
  const ref = (referrer || '').trim();
  const ua = (userAgent || '').trim();

  // 1. Try referrer patterns first (most reliable)
  if (ref) {
    for (const { pattern, platform } of REFERRER_PATTERNS) {
      if (pattern.test(ref)) {
        // Distinguish high confidence (direct domain) vs medium (shim/shortener)
        const isShim = /^(l\.|lm\.|m\.|t\.co|fb\.me|wa\.me)/i.test(
          extractDomain(ref)
        );
        return {
          platform,
          confidence: isShim ? 'medium' : 'high',
        };
      }
    }
  }

  // 2. Empty referrer + WhatsApp User-Agent → low confidence WhatsApp
  // WhatsApp native app strips referrer when opening external links
  if (!ref && ua) {
    for (const pattern of WHATSAPP_UA_PATTERNS) {
      if (pattern.test(ua)) {
        return { platform: PLATFORMS.WHATSAPP, confidence: 'low' };
      }
    }
  }

  // 3. Nothing matched
  return { platform: PLATFORMS.UNKNOWN, confidence: 'none' };
}

/**
 * Extract domain from a URL string safely.
 * Returns empty string on failure.
 */
function extractDomain(url) {
  try {
    // Ensure URL has a protocol for parsing
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(withProtocol).hostname;
  } catch {
    return '';
  }
}

/**
 * Normalise the raw referrer value from request headers.
 * Express gives us req.headers['referer'] OR req.headers['referrer']
 * (both spellings are valid HTTP — yes, the standard has a typo).
 */
export function getReferrer(req) {
  return (
    req.headers['referer'] ||
    req.headers['referrer'] ||
    null
  );
}
