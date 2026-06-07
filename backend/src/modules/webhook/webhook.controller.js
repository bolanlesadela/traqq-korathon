import { processWebhook } from './webhook.service.js';

/**
 * POST /api/webhook/korapay
 *
 * Rules:
 *   1. ALWAYS return 200 immediately after logging.
 *      Non-200 triggers Korapay retries for up to 72 hours.
 *   2. Never let processing errors reach the response.
 *   3. All logic is in the service — controller just receives and responds.
 *
 * Body arrives as raw Buffer (express.raw middleware in app.js).
 * DO NOT move express.json() before this route.
 */
export async function handleKorapayWebhook(req, res) {
  // Respond 200 immediately FIRST, then process.
  // This is the Korapay-recommended pattern — acknowledge before processing.
  res.status(200).json({ received: true });

  // Process asynchronously — response already sent
  // Errors are caught inside processWebhook, never thrown here
  const signatureHeader = req.headers['x-korapay-signature'];
  await processWebhook(req.body, signatureHeader);
}
