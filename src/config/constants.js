/**
 * Central constants file.
 * Never hardcode these strings elsewhere — always import from here.
 * Makes refactoring and testing clean.
 */

export const PLATFORMS = {
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  FACEBOOK: 'facebook',
  X: 'x',
  WHATSAPP: 'whatsapp',
  UNKNOWN: 'unknown',
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export const SALE_SOURCE = {
  AUTO: 'auto',       // came through Korapay webhook
  MANUAL: 'manual',  // vendor entered manually
};

export const INSIGHT_TYPES = {
  TOP_PLATFORM: 'top_platform',
  REVENUE_DROP: 'revenue_drop',
  INACTIVE_PLATFORM: 'inactive_platform',
  BEST_DAY: 'best_day',
  FIRST_SALE: 'first_sale',
};

export const PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export const CURRENCIES = {
  NGN: 'NGN',
  USD: 'USD',
};

export const WEBHOOK_STATUS = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
};

export const TOKEN_EXPIRY = {
  ACCESS: '15m',
  REFRESH: '7d',
  REFRESH_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};
