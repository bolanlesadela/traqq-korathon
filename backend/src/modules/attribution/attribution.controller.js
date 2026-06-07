import { processClick, getVendorPublicInfo } from './attribution.service.js';
import { apiResponse } from '../../utils/apiResponse.js';

/**
 * GET /pay/:vendorSlug
 *
 * The heart of Traqq's attribution system.
 * Public endpoint — no auth. Called every time a customer clicks
 * a vendor's payment link from any platform.
 *
 * Flow:
 *   1. Read referrer + UA headers
 *   2. Detect platform
 *   3. Record click
 *   4. Initialize Korapay checkout
 *   5. Redirect customer to Korapay checkout URL
 */
export async function handlePayClick(req, res) {
  const { vendorSlug } = req.params;

  const { checkoutUrl } = await processClick(req, vendorSlug);

  // Hard redirect to Korapay checkout
  // 302 (temporary) not 301 — we never want this cached
  return res.redirect(302, checkoutUrl);
}

/**
 * GET /pay/:vendorSlug/info
 *
 * Optional: returns vendor's public display info as JSON.
 * Useful if the PWA frontend wants to show a "You're paying {vendor}"
 * screen before redirecting, instead of an instant redirect.
 */
export async function getVendorInfo(req, res) {
  const { vendorSlug } = req.params;

  const vendor = await getVendorPublicInfo(vendorSlug);

  if (!vendor) {
    return apiResponse.error(res, {
      message: 'Vendor not found',
      statusCode: 404,
    });
  }

  return apiResponse.success(res, {
    data: vendor,
  });
}
