import { createHmac } from 'crypto';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { WEBHOOK_STATUS, PAYMENT_STATUS, SALE_SOURCE } from '../../config/constants.js';

// ─── SIGNATURE VERIFICATION ───────────────────────────────────────────────────

/**
 * Verify Korapay webhook signature.
 *
 * CRITICAL — from the docs:
 *   Hash = HMAC-SHA256 of JSON.stringify(req.body.DATA) signed with secret key.
 *   NOT the full body — only the `data` object.
 *   Header: x-korapay-signature
 *
 * We receive raw body (Buffer) from express.raw() middleware.
 * We parse it here — not before — to preserve the exact byte sequence
 * Korapay signed.
 */
export function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return { valid: false, parsed: null };

  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { valid: false, parsed: null };
  }

  // Sign ONLY the data object — exactly as Korapay does it
  const dataString = JSON.stringify(parsed.data);
  const expectedHash = createHmac('sha256', env.korapay.webhookSecret)
    .update(dataString)
    .digest('hex');

  const valid = expectedHash === signatureHeader;
  return { valid, parsed };
}

// ─── WEBHOOK LOG HELPERS ──────────────────────────────────────────────────────

async function logWebhook({ eventType, korapayRef, payload, status, errorMessage, signatureValid }) {
  const { data, error } = await supabase
    .from('webhook_logs')
    .insert({
      event_type: eventType,
      korapay_ref: korapayRef,
      payload,
      status,
      error_message: errorMessage || null,
      signature_valid: signatureValid,
      processed_at: status !== WEBHOOK_STATUS.RECEIVED ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) console.error('[Webhook] Failed to write log:', error.message);
  return data?.id;
}

async function updateWebhookLog(id, { status, errorMessage }) {
  await supabase
    .from('webhook_logs')
    .update({
      status,
      error_message: errorMessage || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

// ─── DUPLICATE CHECK ──────────────────────────────────────────────────────────

/**
 * Check if we've already successfully processed this Korapay reference.
 * Korapay retries webhooks on non-200 responses — deduplication is mandatory.
 */
async function isDuplicate(korapayRef) {
  if (!korapayRef) return false;

  const { data } = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('korapay_ref', korapayRef)
    .eq('status', WEBHOOK_STATUS.PROCESSED)
    .maybeSingle();

  return !!data;
}

// ─── ATTRIBUTION RESOLUTION ───────────────────────────────────────────────────

/**
 * Match the webhook back to a click record using traqq-session metadata.
 * This closes the attribution loop.
 *
 * Returns the click record if found, null otherwise.
 */
async function resolveAttribution(metadata) {
  const sessionId = metadata?.['traqq-session'];
  if (!sessionId) return null;

  const { data: click } = await supabase
    .from('clicks')
    .select('id, vendor_id, platform, session_id')
    .eq('session_id', sessionId)
    .maybeSingle();

  return click || null;
}

// ─── SALE RECORDING ───────────────────────────────────────────────────────────

async function recordSale({ click, vendorId, platform, amount, currency, korapayRef, payload }) {
  // Insert the sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      vendor_id: vendorId,
      click_id: click?.id || null,
      session_id: click?.session_id || null,
      platform,
      amount,
      currency,
      korapay_ref: korapayRef,
      payment_status: PAYMENT_STATUS.SUCCESS,
      source: SALE_SOURCE.AUTO,
      korapay_payload: payload,
      sale_date: payload.data?.transaction_date
        ? new Date(payload.data.transaction_date).toISOString()
        : new Date().toISOString(),
    })
    .select('id')
    .single();

  if (saleError) throw new Error(`Sale insert failed: ${saleError.message}`);

  // Mark the click as converted
  if (click?.id) {
    await supabase
      .from('clicks')
      .update({
        converted: true,
        converted_at: new Date().toISOString(),
      })
      .eq('id', click.id);
  }

  return sale;
}

// ─── INSIGHT TRIGGER ─────────────────────────────────────────────────────────

/**
 * Trigger insight generation asynchronously after a sale.
 * We import lazily to avoid circular dependency issues.
 * This MUST NOT block the webhook response — fire and forget.
 */
async function triggerInsights(vendorId) {
  try {
    const { generateInsights } = await import('../insights/insights.engine.js');
    await generateInsights(vendorId);
  } catch (err) {
    // Never let insight errors affect webhook processing
    console.error('[Insights] Generation failed (non-critical):', err.message);
  }
}

// ─── MAIN PROCESSOR ──────────────────────────────────────────────────────────

/**
 * Full webhook processing pipeline.
 *
 * Pipeline:
 *   1. Parse + verify signature
 *   2. Log raw payload immediately (before anything else)
 *   3. Check for duplicates
 *   4. Only process charge.success events
 *   5. Resolve attribution via session_id metadata
 *   6. Determine vendor (from click or metadata)
 *   7. Record sale
 *   8. Update webhook log to processed
 *   9. Trigger insights async (non-blocking)
 *
 * Always returns { shouldRespond200: true } — we ALWAYS return 200 to Korapay.
 * Errors are logged internally, never exposed to Korapay.
 */
export async function processWebhook(rawBody, signatureHeader) {
  // 1. Verify signature + parse body
  const { valid: signatureValid, parsed } = verifySignature(rawBody, signatureHeader);

  const eventType = parsed?.event || 'unknown';
  const korapayRef = parsed?.data?.reference || null;

  // 2. Log immediately — before any processing
  const logId = await logWebhook({
    eventType,
    korapayRef,
    payload: parsed || {},
    status: WEBHOOK_STATUS.RECEIVED,
    signatureValid,
  });

  // 3. Reject invalid signatures — log, return, don't process
  if (!signatureValid) {
    console.warn('[Webhook] Invalid signature — rejected');
    await updateWebhookLog(logId, {
      status: WEBHOOK_STATUS.FAILED,
      errorMessage: 'Invalid signature',
    });
    return; // Still return 200 to Korapay — don't give attackers info
  }

  // 4. Check for duplicates
  if (await isDuplicate(korapayRef)) {
    console.log(`[Webhook] Duplicate — already processed ref: ${korapayRef}`);
    await updateWebhookLog(logId, { status: WEBHOOK_STATUS.DUPLICATE });
    return;
  }

  // 5. Only process successful charges
  // We log everything but only act on charge.success
  if (eventType !== 'charge.success' || parsed?.data?.status !== 'success') {
    console.log(`[Webhook] Skipping non-success event: ${eventType}`);
    await updateWebhookLog(logId, { status: WEBHOOK_STATUS.PROCESSED });
    return;
  }

  // 6. Extract payment details
  const { amount, currency = 'NGN', metadata } = parsed.data;

  if (!amount || amount <= 0) {
    await updateWebhookLog(logId, {
      status: WEBHOOK_STATUS.FAILED,
      errorMessage: 'Invalid amount',
    });
    return;
  }

  try {
    // 7. Resolve attribution — match to click record via traqq-session
    const click = await resolveAttribution(metadata);

    // Determine vendor and platform
    // Priority: click record → metadata vendor-id → fallback unknown
    let vendorId = click?.vendor_id;
    let platform = click?.platform || 'unknown';

    // If no click found, try to get vendor from metadata
    if (!vendorId && metadata?.['vendor-id']) {
      // vendor-id in metadata is truncated UUID — do a prefix match
      const { data: vendor } = await supabase
        .from('users')
        .select('id')
        .ilike('id', `${metadata['vendor-id']}%`)
        .maybeSingle();
      vendorId = vendor?.id;
    }

    if (!vendorId) {
      throw new Error('Could not resolve vendor from webhook');
    }

    // 8. Record sale
    const sale = await recordSale({
      click,
      vendorId,
      platform,
      amount,
      currency,
      korapayRef,
      payload: parsed,
    });

    // 9. Update log to processed
    await updateWebhookLog(logId, { status: WEBHOOK_STATUS.PROCESSED });

    console.log(`[Webhook] ✅ Sale recorded: ${sale.id} | ${platform} | ${currency} ${amount}`);

    // 10. Trigger insights — async, non-blocking
    triggerInsights(vendorId); // intentionally no await

  } catch (err) {
    console.error('[Webhook] Processing error:', err.message);
    await updateWebhookLog(logId, {
      status: WEBHOOK_STATUS.FAILED,
      errorMessage: err.message,
    });
    // Still don't throw — we return 200 to Korapay regardless
  }
}
