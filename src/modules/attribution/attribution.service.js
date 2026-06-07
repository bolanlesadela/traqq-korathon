import { supabase } from '../../config/supabase.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateSessionId, hashIp, getIp } from '../../utils/helpers.js';
import { detectPlatform, getReferrer } from './referrer.detector.js';
import { env } from '../../config/env.js';

const KORAPAY_INITIALIZE_URL = 'https://api.korapay.com/merchant/api/v1/charges/initialize';

/**
 * Core attribution flow — called when someone hits /pay/:vendorSlug
 *
 * Steps:
 *   1. Look up vendor by slug
 *   2. Detect platform from referrer + UA
 *   3. Record the click with session_id
 *   4. Initialize a Korapay checkout (with metadata containing session_id)
 *   5. Return the Korapay checkout_url to redirect the customer to
 */
export async function processClick(req, vendorSlug) {
  // 1. Look up vendor
  const { data: vendor } = await supabase
    .from('users')
    .select('id, korapay_link, business_name, full_name, currency, is_active')
    .eq('vendor_slug', vendorSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!vendor) {
    throw new AppError('Payment link not found', 404);
  }

  // Vendor hasn't set up their Korapay link yet
  if (!vendor.korapay_link) {
    throw new AppError('This payment link is not yet active', 404);
  }

  // 2. Detect platform
  const referrer = getReferrer(req);
  const userAgent = req.headers['user-agent'] || null;
  const { platform } = detectPlatform(referrer, userAgent);

  // 3. Record the click
  const sessionId = generateSessionId();
  const ipHash = hashIp(getIp(req));

  const { error: clickError } = await supabase
    .from('clicks')
    .insert({
      vendor_id: vendor.id,
      session_id: sessionId,
      platform,
      raw_referrer: referrer,
      user_agent: userAgent,
      ip_hash: ipHash,
    });

  if (clickError) {
    // Don't block the payment — log and continue
    console.error('[Attribution] Failed to record click:', clickError.message);
  }

  // 4. Initialize Korapay checkout
  // We pass session_id in metadata — this is how we close the attribution
  // loop when the webhook comes back
  const korapayRef = `TRAQQ-${sessionId.replace(/-/g, '').substring(0, 16).toUpperCase()}`;

  const checkoutUrl = await initializeKorapayCheckout({
    vendor,
    sessionId,
    korapayRef,
  });

  return { checkoutUrl, sessionId, platform };
}

/**
 * Call Korapay's initialize charge endpoint.
 * Returns the checkout_url to redirect the customer to.
 *
 * We don't know the amount at this point — the vendor's Korapay link
 * handles amount collection. We initialize with amount=0 for open links,
 * OR we use the Checkout Redirect approach where Korapay collects amount.
 *
 * For MVP: we redirect to vendor's existing korapay_link but append
 * traqq_session as a query param in the metadata via a server-side
 * initialized checkout so the webhook carries our session_id back.
 */
async function initializeKorapayCheckout({ vendor, sessionId, korapayRef }) {
  const payload = {
    reference: korapayRef,
    currency: vendor.currency || 'NGN',
    notification_url: `${env.appUrl}/api/webhook/korapay`,
    redirect_url: `${env.frontendUrl}/payment-complete?session=${sessionId}`,
    narration: `Payment to ${vendor.business_name || vendor.full_name}`,
    merchant_bears_cost: true,
    customer: {
      // Generic — vendor's customers don't have accounts with Traqq
      // Korapay will collect their details on the checkout page
      email: 'customer@traqq.co',
      name: 'Customer',
    },
    metadata: {
      // This is the attribution anchor — comes back in webhook data.metadata
      // Key must be ≤20 chars — 'traqq-session' is 13 chars ✓
      'traqq-session': sessionId,
      'vendor-id': vendor.id.substring(0, 20), // truncate UUID to fit 20 char limit
      platform,
    },
    channels: ['bank_transfer', 'card'],
    default_channel: 'bank_transfer', // most common in Nigeria
  };

  const response = await fetch(KORAPAY_INITIALIZE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.korapay.secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!result.status || !result.data?.checkout_url) {
    console.error('[Korapay] Initialize failed:', result);
    throw new AppError('Payment initialization failed. Please try again.', 502);
  }

  return result.data.checkout_url;
}

/**
 * Get vendor's public-facing info for the payment page.
 * Used by the frontend to show vendor name before redirecting.
 */
export async function getVendorPublicInfo(vendorSlug) {
  const { data } = await supabase
    .from('users')
    .select('business_name, full_name, vendor_slug, currency')
    .eq('vendor_slug', vendorSlug)
    .eq('is_active', true)
    .maybeSingle();

  return data;
}
