-- ============================================================
-- TRAQQ DATABASE — SCRIPT 8: TEST SEED DATA
-- ============================================================
-- Run this ONLY in development to test your dashboard and APIs.
-- DO NOT run in production.
--
-- Creates:
--   1 test vendor
--   6 clicks (one per platform)
--   6 sales (one per platform, all NGN)
--   2 insights
-- ============================================================

-- Test vendor
-- Password is: TestPassword123!
-- (bcrypt hash generated externally — update with real hash when testing auth)
INSERT INTO users (
  id, email, password_hash, full_name, business_name,
  vendor_slug, korapay_link, currency
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testvendor@traqq.co',
  '$2b$12$placeholderhashreplacewithreal.hashhere',
  'Adaeze Okafor',
  'Adaeze Fashion Store',
  'adaeze-fashion-k92xp',
  'https://korahq.com/l/test-payment-link',
  'NGN'
) ON CONFLICT (id) DO NOTHING;

-- Test clicks — one per platform
INSERT INTO clicks (vendor_id, session_id, platform, raw_referrer, converted, converted_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'instagram', 'https://www.instagram.com/', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'tiktok',    'https://www.tiktok.com/',    true, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'facebook',  'https://www.facebook.com/', true, now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'x',         'https://t.co/abc123',       true, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000005', 'whatsapp',  null,                        true, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006', 'unknown',   'https://somesite.com',      false, null)
ON CONFLICT DO NOTHING;

-- Test sales — matching the clicks above
INSERT INTO sales (
  vendor_id, session_id, platform, amount, currency,
  product_name, korapay_ref, payment_status, source, sale_date
) VALUES
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'instagram', 25000.00, 'NGN', 'Ankara Dress',      'KPY-TEST-001', 'success', 'auto',   now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'tiktok',    15000.00, 'NGN', 'Lace Blouse',       'KPY-TEST-002', 'success', 'auto',   now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'facebook',  8000.00,  'NGN', 'Head Tie',          'KPY-TEST-003', 'success', 'auto',   now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'x',         5000.00,  'NGN', 'Accessories Set',   'KPY-TEST-004', 'success', 'auto',   now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000005', 'whatsapp',  12000.00, 'NGN', 'Custom Order',      'KPY-TEST-005', 'success', 'auto',   now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', null,                                  'instagram', 18000.00, 'NGN', 'Aso-oke Set',       null,           'success', 'manual', now() - interval '6 days')
ON CONFLICT DO NOTHING;

-- Test insights
INSERT INTO insights (vendor_id, insight_type, message, data_snapshot, period)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'top_platform',
    'Instagram is your strongest platform this week — it brought in ₦43,000, which is 52% of your total revenue.',
    '{"platform": "instagram", "revenue": 43000, "percentage": 52, "period": "weekly"}',
    'weekly'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'inactive_platform',
    'You haven''t made a sale from X in 4 days. It may not be worth your time right now.',
    '{"platform": "x", "days_inactive": 4}',
    'weekly'
  )
ON CONFLICT DO NOTHING;

-- Verify seed data
SELECT 'users'         AS tbl, COUNT(*) FROM users
UNION ALL
SELECT 'clicks'        AS tbl, COUNT(*) FROM clicks
UNION ALL
SELECT 'sales'         AS tbl, COUNT(*) FROM sales
UNION ALL
SELECT 'insights'      AS tbl, COUNT(*) FROM insights;
