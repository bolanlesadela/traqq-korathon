-- ============================================================
-- TRAQQ DATABASE — SCRIPT 3: REFRESH TOKENS TABLE
-- ============================================================
-- Why store refresh tokens in the DB at all?
-- So we can REVOKE them. JWT access tokens can't be revoked
-- (they're stateless), but refresh tokens live here and we
-- can mark them revoked on logout or suspicious activity.
--
-- Why store a hash, not the raw token?
-- Same reason we hash passwords. If the DB is compromised,
-- an attacker can't use stored token hashes to authenticate.
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which vendor owns this token
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 hash of the actual refresh token
  -- The raw token is only ever in the HTTP response, never persisted
  token_hash    text UNIQUE NOT NULL,

  -- When this token expires (matches JWT_REFRESH_EXPIRES_IN = 7 days)
  expires_at    timestamptz NOT NULL,

  -- Revoked on: logout, password change, suspicious activity
  revoked       boolean NOT NULL DEFAULT false,

  -- Useful for debugging: which device/browser issued this token
  user_agent    text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by token_hash (used on every token refresh)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
  ON refresh_tokens(token_hash);

-- Fast lookup of all tokens for a user (used on logout-all-devices)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens(user_id);

-- Cleanup job: delete expired tokens automatically
-- Supabase doesn't run pg_cron by default on free tier,
-- so we handle cleanup in the Node.js auth service instead.
-- This index makes that cleanup query fast.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens(expires_at);

SELECT 'refresh_tokens table created' AS status;
