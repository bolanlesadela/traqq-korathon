-- ============================================================
-- TRAQQ DATABASE — SCRIPT 9: ANALYTICS VIEWS
-- ============================================================
-- Pre-built views for common dashboard queries.
-- Views don't store data — they're saved queries.
-- Makes the Node.js analytics service queries simpler and faster.
-- ============================================================

-- ── VIEW: Revenue by platform (all time, per vendor) ─────────
CREATE OR REPLACE VIEW v_revenue_by_platform AS
SELECT
  vendor_id,
  platform,
  COUNT(*)                          AS sale_count,
  SUM(amount)                       AS total_revenue,
  ROUND(AVG(amount), 2)             AS avg_order_value,
  currency
FROM sales
WHERE payment_status = 'success'
  AND is_deleted = false
GROUP BY vendor_id, platform, currency;

-- ── VIEW: Daily revenue summary (last 90 days) ───────────────
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  vendor_id,
  DATE(sale_date)                   AS sale_day,
  platform,
  COUNT(*)                          AS sale_count,
  SUM(amount)                       AS daily_revenue,
  currency
FROM sales
WHERE payment_status = 'success'
  AND is_deleted = false
  AND sale_date >= now() - interval '90 days'
GROUP BY vendor_id, DATE(sale_date), platform, currency
ORDER BY sale_day DESC;

-- ── VIEW: Weekly revenue summary ─────────────────────────────
CREATE OR REPLACE VIEW v_weekly_revenue AS
SELECT
  vendor_id,
  DATE_TRUNC('week', sale_date)     AS week_start,
  platform,
  COUNT(*)                          AS sale_count,
  SUM(amount)                       AS weekly_revenue,
  currency
FROM sales
WHERE payment_status = 'success'
  AND is_deleted = false
GROUP BY vendor_id, DATE_TRUNC('week', sale_date), platform, currency
ORDER BY week_start DESC;

-- ── VIEW: Vendor dashboard overview ──────────────────────────
CREATE OR REPLACE VIEW v_vendor_overview AS
SELECT
  u.id                              AS vendor_id,
  u.business_name,
  u.vendor_slug,
  COUNT(DISTINCT s.id)              AS total_sales,
  COALESCE(SUM(s.amount), 0)        AS total_revenue,
  COUNT(DISTINCT c.id)              AS total_clicks,
  ROUND(
    CASE WHEN COUNT(DISTINCT c.id) > 0
    THEN COUNT(DISTINCT CASE WHEN c.converted THEN c.id END)::numeric
       / COUNT(DISTINCT c.id) * 100
    ELSE 0 END, 1
  )                                 AS conversion_rate_pct,
  u.currency
FROM users u
LEFT JOIN sales s ON s.vendor_id = u.id
  AND s.payment_status = 'success'
  AND s.is_deleted = false
LEFT JOIN clicks c ON c.vendor_id = u.id
GROUP BY u.id, u.business_name, u.vendor_slug, u.currency;

SELECT 'analytics views created' AS status;
