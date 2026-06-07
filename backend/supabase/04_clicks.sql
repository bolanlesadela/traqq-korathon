-- ============================================================
-- TRAQQ DATABASE — SCRIPT 4: CLICKS TABLE
-- ============================================================
-- This is the attribution engine's first half.
-- Every time someone clicks /pay/:vendorSlug, we create a click
-- record BEFORE redirecting them to Korapay.
--
-- The session_id bridges this record to the eventual payment.
-- When Korapay fires a webhook, we match on session_id
-- and know exactly which platform drove that sale.
-- ============================================================

CREATE TABLE IF NOT EXISTS clicks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which vendor's link was clicked
  vendor_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The attribution bridge key.
  -- Created here, appended to Korapay URL as ?traqq_session=<uuid>,
  -- comes back in the webhook via Korapay metadata field.
  session_id      uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),

  -- Detected platform from referrer/UA analysis
  -- 'unknown' is a valid, expected value — not an error
  platform        text NOT NULL DEFAULT 'unknown'
                  CHECK (platform IN (
                    'instagram', 'tiktok', 'facebook',
                    'x', 'whatsapp', 'unknown'
                  )),

  -- Raw referrer header stored for debugging and re-processing
  -- Never use this for business logic — use platform field
  raw_referrer    text,

  -- User-Agent stored to help improve platform detection over time
  -- Also useful for detecting bot clicks
  user_agent      text,

  -- Hashed IP for deduplication (never raw IP — privacy by design)
  ip_hash         text,

  -- Flipped to true when a successful payment webhook matches this click
  -- Unmatched clicks = window shoppers, attribution drop-off insight
  converted       boolean NOT NULL DEFAULT false,

  -- When conversion happened (set alongside converted = true)
  converted_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by session_id — used in EVERY webhook processing call
-- This index is critical for attribution speed
CREATE INDEX IF NOT EXISTS idx_clicks_session_id
  ON clicks(session_id);

-- Analytics: count clicks per vendor per platform per time period
CREATE INDEX IF NOT EXISTS idx_clicks_vendor_platform
  ON clicks(vendor_id, platform, created_at DESC);

-- Find unconverted clicks for funnel analysis
CREATE INDEX IF NOT EXISTS idx_clicks_converted
  ON clicks(vendor_id, converted, created_at DESC);

SELECT 'clicks table created' AS status;
