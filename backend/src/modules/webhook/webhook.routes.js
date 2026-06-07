import { Router } from 'express';
import { handleKorapayWebhook } from './webhook.controller.js';
import { webhookLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

/**
 * No JWT auth on this route — it's called by Korapay's servers, not vendors.
 * Security is handled by HMAC signature verification inside the service.
 *
 * Body is already raw Buffer — express.raw() is mounted in app.js
 * specifically for /api/webhook before express.json() runs.
 */
router.post('/korapay', webhookLimiter, handleKorapayWebhook);

export default router;
