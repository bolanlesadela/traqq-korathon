-- ============================================================
-- TRAQQ SEED DATA — Development only
-- Run AFTER schema.sql
-- Creates one test vendor with realistic sales data across platforms
-- ============================================================

-- ── TEST VENDOR ──────────────────────────────────────────────
-- Password is: Test1234! (bcrypt hash below)
INSERT INTO users (id, email, password_hash, full_name, business_name, vendor_slug, korapay_link, currency)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'adaeze@test.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMGJed7030COPvN15QdYGTRb2m', -- Test1234!
  'Adaeze Okonkwo',
  'Adaeze Fashion Store',
  'adaeze-fashion-a3k9x',
  'https://pay.korahq.com/adaeze-fashion',
  'NGN'
);

-- ── TEST CLICKS ───────────────────────────────────────────────
INSERT INTO clicks (vendor_id, session_id, platform, raw_referrer, converted, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'instagram', 'https://www.instagram.com/', true,  now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'whatsapp',  null,                          true,  now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'instagram', 'https://l.instagram.com/',    true,  now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa', 'tiktok',    'https://www.tiktok.com/',     true,  now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', 'facebook',  'https://www.facebook.com/',   false, now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa', 'instagram', 'https://www.instagram.com/',  true,  now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa', 'x',         'https://t.co/',               true,  now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa', 'whatsapp',  null,                          true,  now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0009-0009-0009-aaaaaaaaaaaa', 'instagram', 'https://www.instagram.com/',  true,  now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0010-0010-0010-aaaaaaaaaaaa', 'tiktok',    'https://www.tiktok.com/',     false, now() - interval '1 day');

-- ── TEST SALES ────────────────────────────────────────────────
INSERT INTO sales (vendor_id, click_id, session_id, platform, amount, currency, product_name, payment_status, source, sale_date) VALUES
-- This week
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'instagram', 15000, 'NGN', 'Ankara Midi Dress',    'success', 'auto',   now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'whatsapp',  12500, 'NGN', 'Lace Blouse Set',      'success', 'auto',   now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'instagram', 22000, 'NGN', 'Aso-Oke Wrapper',      'success', 'auto',   now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa', 'tiktok',     8000, 'NGN', 'Casual Kaftan',        'success', 'auto',   now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa', 'instagram', 18500, 'NGN', 'Palazzo Trousers',     'success', 'auto',   now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa', 'x',          6500, 'NGN', 'Headwrap Bundle',      'success', 'auto',   now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa', 'whatsapp',  14000, 'NGN', 'Adire Fabric (5 yds)', 'success', 'auto',   now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111', null, 'aaaaaaaa-0009-0009-0009-aaaaaaaaaaaa', 'instagram', 25000, 'NGN', 'Bridal Lace Set',      'success', 'auto',   now() - interval '2 days'),
-- Manual sale
('11111111-1111-1111-1111-111111111111', null, null,                                   'whatsapp',   9500, 'NGN', 'Chiffon Blouse',       'success', 'manual', now() - interval '1 day'),
-- Last month (for timeline comparisons)
('11111111-1111-1111-1111-111111111111', null, null, 'instagram', 19000, 'NGN', 'Ankara Co-ord Set',   'success', 'auto',   now() - interval '14 days'),
('11111111-1111-1111-1111-111111111111', null, null, 'whatsapp',  11000, 'NGN', 'Plain Fabric',        'success', 'auto',   now() - interval '18 days'),
('11111111-1111-1111-1111-111111111111', null, null, 'tiktok',     7500, 'NGN', 'Hair Accessories',    'success', 'auto',   now() - interval '21 days'),
('11111111-1111-1111-1111-111111111111', null, null, 'instagram', 32000, 'NGN', 'Owambe Dress',        'success', 'auto',   now() - interval '25 days'),
('11111111-1111-1111-1111-111111111111', null, null, 'facebook',   5000, 'NGN', 'Scrunchie Pack',      'success', 'auto',   now() - interval '28 days');

-- ── TEST INSIGHTS ─────────────────────────────────────────────
INSERT INTO insights (vendor_id, insight_type, message, data_snapshot, period) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'top_platform',
  'Instagram is your strongest platform this week — ₦80,500 (62% of total revenue). Keep posting consistently.',
  '{"platform": "instagram", "amount": 80500, "percentage": 62, "period": "week"}',
  'weekly'
),
(
  '11111111-1111-1111-1111-111111111111',
  'inactive_platform',
  'You haven''t made a sale from TikTok in 4 days. It may not be driving revenue right now.',
  '{"platform": "tiktok", "last_sale_days_ago": 4}',
  'weekly'
);

-- ── VERIFY SEED ───────────────────────────────────────────────
SELECT 'users' as table_name, COUNT(*) as rows FROM users
UNION ALL
SELECT 'clicks', COUNT(*) FROM clicks
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'insights', COUNT(*) FROM insights;
