-- ============================================================
-- TRAQQ DATABASE — SCRIPT 5: SALES TABLE
-- ============================================================
-- This is where money lives. Every confirmed sale ends up here.
-- Two entry paths:
--   1. AUTO: Korapay webhook fires → matched to click → inserted
--   2. MANUAL: Vendor types it in → inserted with source='manual'
--
-- click_id is nullable because manual sales have no click record.
-- platform is always required — manual sales ask vendor "which
-- platform did this come from?"
-- ============================================================

CREATE TABLE IF NOT EXISTS sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vendor who made the sale
  vendor_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Attribution link — null for manual sales
  click_id          uuid REFERENCES clicks(id) ON DELETE SET NULL,

  -- Denormalized from click for query performance
  -- (avoids join on every analytics query)
  session_id        uuid,

  -- Platform attribution — the whole point of Traqq
  platform          text NOT NULL DEFAULT 'unknown'
                    CHECK (platform IN (
                      'instagram', 'tiktok', 'facebook',
                      'x', 'whatsapp', 'unknown'
                    )),

  -- Money fields
  amount            numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency          text NOT NULL DEFAULT 'NGN'
                    CHECK (currency IN ('NGN', 'USD', 'GHS')),

  -- Optional product context (vendor can fill this in)
  product_name      text,

  -- Korapay transaction reference — unique per transaction
  -- Used for deduplication in webhook processing
  korapay_ref       text UNIQUE,           -- null for manual sales

  -- pending → success or failed (updated by webhook)
  payment_status    text NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'success', 'failed')),

  -- auto = came through Korapay webhook
  -- manual = vendor entered it themselves
  source            text NOT NULL DEFAULT 'auto'
                    CHECK (source IN ('auto', 'manual')),

  -- Full Korapay webhook payload stored raw.
  -- This means if our processing logic changes, we can re-process
  -- without losing any original data. Invaluable for debugging.
  korapay_payload   jsonb,

  -- Soft delete
  is_deleted        boolean NOT NULL DEFAULT false,

  -- When the sale actually happened (not when we recorded it)
  -- For webhooks, this comes from Korapay's paid_at field
  -- For manual, this is set by vendor or defaults to now()
  sale_date         timestamptz NOT NULL DEFAULT now(),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- THE most queried index: vendor's sales by date, filtered by platform
-- Powers the entire analytics dashboard
CREATE INDEX IF NOT EXISTS idx_sales_vendor_date
  ON sales(vendor_id, sale_date DESC)
  WHERE is_deleted = false;

-- Platform breakdown queries
CREATE INDEX IF NOT EXISTS idx_sales_vendor_platform
  ON sales(vendor_id, platform, sale_date DESC)
  WHERE is_deleted = false AND payment_status = 'success';

-- Deduplication check on korapay_ref (also enforced by UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_sales_korapay_ref
  ON sales(korapay_ref)
  WHERE korapay_ref IS NOT NULL;

-- Auto-update updated_at
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'sales table created' AS status;
