import { Router } from 'express';
import { handlePayClick, getVendorInfo } from './attribution.controller.js';
import { redirectLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

/**
 * Public routes — no JWT auth.
 * These are hit by customers clicking vendor links, not by vendors.
 *
 * Rate limited generously (60/min) — real customers clicking links.
 * Stricter limits would hurt conversion.
 */

// The main attribution + redirect endpoint
// Every vendor's shareable link points here
router.get('/:vendorSlug', redirectLimiter, handlePayClick);

// Optional info endpoint for PWA pre-redirect screen
router.get('/:vendorSlug/info', redirectLimiter, getVendorInfo);

export default router;
