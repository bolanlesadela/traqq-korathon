-- ============================================================
-- TRAQQ DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor → New Query
-- Run sections in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================
-- uuid generation built into Postgres — no external lib needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SECTION 2: USERS
-- Core vendor account. Everything else references this.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text UNIQUE NOT NULL,
  password_hash     text NOT NULL,
  full_name         text NOT NULL,
  business_name     text,
  vendor_slug       text UNIQUE NOT NULL,     -- public URL identifier e.g. "adaeze-fashion-a3k9x"
  korapay_link      text,                     -- their actual Korapay payment page URL
  currency          text NOT NULL DEFAULT 'NGN',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for slug lookup — this runs on every payment redirect, must be fast
CREATE INDEX idx_users_vendor_slug ON users(vendor_slug);
CREATE INDEX idx_users_email ON users(email);

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


-- ============================================================
-- SECTION 3: CLICKS
-- Every time someone hits /pay/:vendorSlug, a click is recorded.
-- The session_id is the bridge between this click and the payment.
-- ============================================================
CREATE TABLE IF NOT EXISTS clicks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      uuid UNIQUE NOT NULL,         -- bridge to sales table
  platform        text NOT NULL DEFAULT 'unknown', -- instagram|tiktok|facebook|x|whatsapp|unknown
  raw_referrer    text,                          -- raw Referer header value (debug use)
  user_agent      text,                          -- raw User-Agent (debug use)
  ip_hash         text,                          -- SHA-256 hashed IP, never raw
  converted       boolean NOT NULL DEFAULT false, -- true = payment completed for this click
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for attribution matching and analytics queries
CREATE INDEX idx_clicks_vendor_id ON clicks(vendor_id);
CREATE INDEX idx_clicks_session_id ON clicks(session_id);
CREATE INDEX idx_clicks_platform ON clicks(platform);
CREATE INDEX idx_clicks_created_at ON clicks(created_at);
CREATE INDEX idx_clicks_converted ON clicks(converted);

-- Validate platform values at DB level — never trust application layer alone
ALTER TABLE clicks ADD CONSTRAINT clicks_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'x', 'whatsapp', 'unknown'));


-- ============================================================
-- SECTION 4: SALES
-- A sale is created when a Korapay webhook fires (auto)
-- or when a vendor records one manually.
-- click_id is nullable — manual sales have no click.
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  click_id         uuid REFERENCES clicks(id) ON DELETE SET NULL, -- nullable
  session_id       uuid,                          -- matches clicks.session_id (nullable for manual)
  platform         text NOT NULL DEFAULT 'unknown',
  amount           numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency         text NOT NULL DEFAULT 'NGN',
  product_name     text,
  customer_ref     text,                          -- Korapay transaction reference
  payment_status   text NOT NULL DEFAULT 'pending',
  source           text NOT NULL DEFAULT 'auto', -- auto|manual
  korapay_payload  jsonb,                         -- full raw webhook body
  is_deleted       boolean NOT NULL DEFAULT false, -- soft delete
  sale_date        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Core query indexes — dashboard filters by vendor + date + platform constantly
CREATE INDEX idx_sales_vendor_id ON sales(vendor_id);
CREATE INDEX idx_sales_platform ON sales(platform);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sales_source ON sales(source);
CREATE INDEX idx_sales_session_id ON sales(session_id);
-- Composite index for the most common dashboard query: vendor + date + not deleted
CREATE INDEX idx_sales_vendor_date ON sales(vendor_id, sale_date) WHERE is_deleted = false;

-- Constraint checks
ALTER TABLE sales ADD CONSTRAINT sales_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'x', 'whatsapp', 'unknown'));

ALTER TABLE sales ADD CONSTRAINT sales_payment_status_check
  CHECK (payment_status IN ('pending', 'success', 'failed'));

ALTER TABLE sales ADD CONSTRAINT sales_source_check
  CHECK (source IN ('auto', 'manual'));

ALTER TABLE sales ADD CONSTRAINT sales_currency_check
  CHECK (currency IN ('NGN', 'USD'));


-- ============================================================
-- SECTION 5: WEBHOOK LOGS
-- Every incoming Korapay webhook is logged BEFORE processing.
-- This is your audit trail and retry safety net.
-- Non-negotiable for production payment systems.
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       text,                          -- e.g. "charge.success"
  korapay_ref      text,                          -- Korapay's transaction reference
  payload          jsonb NOT NULL,                -- full raw payload
  status           text NOT NULL DEFAULT 'received',
  error_message    text,                          -- populated if processing failed
  received_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_korapay_ref ON webhook_logs(korapay_ref);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at);

ALTER TABLE webhook_logs ADD CONSTRAINT webhook_logs_status_check
  CHECK (status IN ('received', 'processed', 'failed', 'duplicate'));


-- ============================================================
-- SECTION 6: REFRESH TOKENS
-- We manage refresh tokens ourselves (not Supabase Auth).
-- Hashed before storage. Rotated on every use.
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text UNIQUE NOT NULL,       -- bcrypt/SHA-256 hash of the actual token
  expires_at   timestamptz NOT NULL,
  revoked      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
-- Partial index — only index active tokens (not expired or revoked)
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(token_hash)
  WHERE revoked = false;


-- ============================================================
-- SECTION 7: INSIGHTS
-- Generated by the rule engine after every successful sale.
-- Stored so the dashboard can show them without re-computing.
-- ============================================================
CREATE TABLE IF NOT EXISTS insights (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type   text NOT NULL,            -- top_platform|revenue_drop|inactive_platform|best_day|first_sale
  message        text NOT NULL,            -- plain English for the vendor
  data_snapshot  jsonb,                    -- the numbers that produced this insight
  period         text NOT NULL DEFAULT 'weekly',
  is_read        boolean NOT NULL DEFAULT false,
  generated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_vendor_id ON insights(vendor_id);
CREATE INDEX idx_insights_generated_at ON insights(generated_at);
CREATE INDEX idx_insights_is_read ON insights(is_read);

ALTER TABLE insights ADD CONSTRAINT insights_type_check
  CHECK (insight_type IN ('top_platform', 'revenue_drop', 'inactive_platform', 'best_day', 'first_sale'));

ALTER TABLE insights ADD CONSTRAINT insights_period_check
  CHECK (period IN ('daily', 'weekly', 'monthly'));


-- ============================================================
-- SECTION 8: ROW LEVEL SECURITY (RLS)
-- Vendors can only see their own data.
-- Our backend uses the service role key (bypasses RLS).
-- RLS is a safety net if the anon key ever leaks.
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS — our Node.js backend uses this
-- No policies needed for service role, it always has full access

-- Anon/authenticated role policies (fallback protection)
-- Users can only read their own record
CREATE POLICY "users: own record only"
  ON users FOR ALL
  USING (auth.uid() = id);

-- Vendors can only see their own clicks
CREATE POLICY "clicks: own vendor only"
  ON clicks FOR ALL
  USING (vendor_id = auth.uid());

-- Vendors can only see their own sales
CREATE POLICY "sales: own vendor only"
  ON sales FOR ALL
  USING (vendor_id = auth.uid());

-- Vendors can only see their own insights
CREATE POLICY "insights: own vendor only"
  ON insights FOR ALL
  USING (vendor_id = auth.uid());

-- Refresh tokens — own user only
CREATE POLICY "refresh_tokens: own user only"
  ON refresh_tokens FOR ALL
  USING (user_id = auth.uid());

-- Webhook logs — no direct client access ever
CREATE POLICY "webhook_logs: no client access"
  ON webhook_logs FOR ALL
  USING (false);


-- ============================================================
-- VERIFY: Run this after to confirm all tables exist
-- ============================================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name
   AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
