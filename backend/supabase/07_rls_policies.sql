-- ============================================================
-- TRAQQ DATABASE — SCRIPT 7: ROW LEVEL SECURITY (RLS)
-- ============================================================
-- RLS is Supabase's database-level security layer.
-- Even if someone gets your anon key, they can't read another
-- vendor's data — the database itself enforces ownership.
--
-- IMPORTANT: Our backend uses the SERVICE ROLE KEY which bypasses
-- RLS entirely. RLS here is a defence-in-depth measure —
-- it protects against misconfigured queries or future frontend
-- direct-to-Supabase calls.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- ── POLICY: Service role bypasses everything ──────────────────
-- Our Node.js backend uses service role key → full access.
-- These policies apply to anon/authenticated Supabase tokens only.

-- ── USERS: vendors can only read/update their own row ─────────
CREATE POLICY "users: own row only"
  ON users FOR ALL
  USING (auth.uid()::text = id::text);

-- ── REFRESH TOKENS: own tokens only ──────────────────────────
CREATE POLICY "refresh_tokens: own tokens only"
  ON refresh_tokens FOR ALL
  USING (auth.uid()::text = user_id::text);

-- ── CLICKS: vendors can only see clicks on their links ────────
CREATE POLICY "clicks: own vendor only"
  ON clicks FOR ALL
  USING (auth.uid()::text = vendor_id::text);

-- ── SALES: vendors can only see their own sales ───────────────
CREATE POLICY "sales: own vendor only"
  ON sales FOR ALL
  USING (auth.uid()::text = vendor_id::text);

-- ── WEBHOOK LOGS: backend only, no direct client access ───────
-- No permissive policy = no access via anon/authenticated keys
-- Only service role (our backend) can touch this table

-- ── INSIGHTS: vendors can only see their own insights ─────────
CREATE POLICY "insights: own vendor only"
  ON insights FOR ALL
  USING (auth.uid()::text = vendor_id::text);

SELECT 'RLS policies applied' AS status;
