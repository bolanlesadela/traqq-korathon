-- ============================================================
-- TRAQQ DATABASE — SCRIPT 2: USERS TABLE
-- ============================================================
-- Why we manage our own users table instead of using Supabase Auth:
-- Supabase Auth is for frontend session management.
-- We use JWT issued by our own backend (Node.js + bcrypt).
-- This gives us full control over token shape, refresh logic,
-- and vendor-specific fields like slug and korapay_link.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth fields
  email             text UNIQUE NOT NULL,
  password_hash     text NOT NULL,           -- bcrypt hash, cost factor 12

  -- Profile fields
  full_name         text NOT NULL,
  business_name     text,                    -- optional, shown on dashboard

  -- Attribution anchor — this is what goes in the /pay/:vendorSlug URL
  -- Must be unique, URL-safe, human-readable
  -- e.g. "adaeze-fashion-store-k92xp"
  vendor_slug       text UNIQUE NOT NULL,

  -- The vendor's actual Korapay payment URL
  -- We redirect to this after recording the click
  -- Nullable on signup — vendor adds it in onboarding
  korapay_link      text,

  -- Currency preference — NGN default for Nigerian vendors
  currency          text NOT NULL DEFAULT 'NGN'
                    CHECK (currency IN ('NGN', 'USD', 'GHS')),

  -- Soft delete — never hard delete vendor records
  is_active         boolean NOT NULL DEFAULT true,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index on email for fast login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on vendor_slug for fast /pay/:vendorSlug redirects
-- This endpoint is hit every time a customer clicks a payment link
-- It must be instant
CREATE INDEX IF NOT EXISTS idx_users_vendor_slug ON users(vendor_slug);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Confirm
SELECT 'users table created' AS status;
