-- ============================================================
-- TRAQQ DATABASE — SCRIPT 1: EXTENSIONS & SETUP
-- Run this first, before any table creation.
-- ============================================================

-- Enable UUID generation (gen_random_uuid())
-- Supabase enables this by default but we make it explicit
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pg_trgm for future search functionality (vendor search, etc.)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Confirm extensions are active
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pgcrypto', 'pg_trgm');
