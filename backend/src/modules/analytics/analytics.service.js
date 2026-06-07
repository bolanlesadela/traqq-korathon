import { supabase } from '../../config/supabase.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PLATFORM_LIST } from '../../config/constants.js';

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function getPeriodRange(period) {
  const now = new Date();
  const ranges = {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    week:  new Date(Date.now() - 7  * 24 * 60 * 60 * 1000),
    month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  };
  return ranges[period] ? ranges[period].toISOString() : ranges.month.toISOString();
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

/**
 * Dashboard overview card — the first thing a vendor sees.
 * Returns: total revenue, total sales, top platform, conversion rate.
 * Also returns week-over-week change for the revenue trend indicator.
 */
export async function getOverview(vendorId, period = 'month') {
  const fromDate = getPeriodRange(period);

  // Current period sales
  const { data: current, error } = await supabase
    .from('sales')
    .select('amount, platform, currency')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', fromDate);

  if (error) throw new AppError('Failed to fetch overview', 500);

  // Previous period (same duration, shifted back)
  const periodMs   = Date.now() - new Date(fromDate).getTime();
  const prevFrom   = new Date(new Date(fromDate).getTime() - periodMs).toISOString();
  const prevTo     = fromDate;

  const { data: previous } = await supabase
    .from('sales')
    .select('amount')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', prevFrom)
    .lt('sale_date', prevTo);

  // Click-to-sale conversion rate
  const { count: totalClicks } = await supabase
    .from('clicks')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .gte('created_at', fromDate);

  // Compute totals
  const totalRevenue  = current.reduce((sum, s) => sum + Number(s.amount), 0);
  const prevRevenue   = (previous || []).reduce((sum, s) => sum + Number(s.amount), 0);
  const totalSales    = current.length;
  const currency      = current[0]?.currency || 'NGN';
  const conversionRate = totalClicks > 0
    ? Math.round((totalSales / totalClicks) * 100 * 10) / 10
    : 0;

  // Revenue change percentage vs previous period
  const revenueChange = prevRevenue > 0
    ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10
    : null; // null = no previous data to compare

  // Top platform by revenue
  const platformTotals = {};
  for (const sale of current) {
    platformTotals[sale.platform] = (platformTotals[sale.platform] || 0) + Number(sale.amount);
  }
  const topPlatform = Object.entries(platformTotals)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  return {
    period,
    total_revenue: totalRevenue,
    total_sales: totalSales,
    total_clicks: totalClicks || 0,
    conversion_rate_pct: conversionRate,
    revenue_change_pct: revenueChange,
    top_platform: topPlatform,
    currency,
  };
}

// ─── PLATFORM BREAKDOWN ───────────────────────────────────────────────────────

/**
 * Revenue and sales count broken down by platform.
 * Powers the pie/bar chart on the dashboard.
 * Includes percentage of total for each platform.
 */
export async function getRevenueByPlatform(vendorId, period = 'month') {
  const fromDate = getPeriodRange(period);

  const { data, error } = await supabase
    .from('sales')
    .select('platform, amount, currency')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', fromDate);

  if (error) throw new AppError('Failed to fetch platform breakdown', 500);

  // Aggregate in JS — avoids complex GROUP BY on Supabase
  const totals = {};
  let grandTotal = 0;

  for (const sale of data) {
    if (!totals[sale.platform]) {
      totals[sale.platform] = { platform: sale.platform, revenue: 0, sales: 0, currency: sale.currency };
    }
    totals[sale.platform].revenue += Number(sale.amount);
    totals[sale.platform].sales   += 1;
    grandTotal += Number(sale.amount);
  }

  // Add percentage + ensure all platforms appear (even with 0)
  const breakdown = PLATFORM_LIST.map(platform => {
    const entry = totals[platform] || { platform, revenue: 0, sales: 0, currency: 'NGN' };
    return {
      ...entry,
      revenue:    Math.round(entry.revenue * 100) / 100,
      percentage: grandTotal > 0
        ? Math.round((entry.revenue / grandTotal) * 100 * 10) / 10
        : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return { breakdown, total_revenue: grandTotal };
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

/**
 * Revenue over time — for the line/bar chart.
 * Groups by day (for week view) or by day for month view.
 * Frontend receives an array ready to pass to Chart.js / Recharts.
 */
export async function getTimeline(vendorId, period = 'month') {
  const fromDate = getPeriodRange(period);

  const { data, error } = await supabase
    .from('sales')
    .select('amount, sale_date, platform')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', fromDate)
    .order('sale_date', { ascending: true });

  if (error) throw new AppError('Failed to fetch timeline', 500);

  // Group by date string (YYYY-MM-DD)
  const byDate = {};
  for (const sale of data) {
    const day = sale.sale_date.substring(0, 10); // 'YYYY-MM-DD'
    if (!byDate[day]) byDate[day] = { date: day, revenue: 0, sales: 0 };
    byDate[day].revenue += Number(sale.amount);
    byDate[day].sales   += 1;
  }

  // Fill in missing days with 0 so the chart has no gaps
  const timeline = [];
  const start = new Date(fromDate);
  const end   = new Date();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().substring(0, 10);
    timeline.push(byDate[key] || { date: key, revenue: 0, sales: 0 });
  }

  return timeline;
}

// ─── PLATFORM COMPARISON ──────────────────────────────────────────────────────

/**
 * Side-by-side platform comparison across two periods.
 * Tells vendor: "Instagram was up 40% vs last week."
 * This is a core insight driver.
 */
export async function comparePlatforms(vendorId, period = 'week') {
  const fromDate   = getPeriodRange(period);
  const periodMs   = Date.now() - new Date(fromDate).getTime();
  const prevFrom   = new Date(new Date(fromDate).getTime() - periodMs).toISOString();

  // Current period
  const { data: current } = await supabase
    .from('sales')
    .select('platform, amount')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', fromDate);

  // Previous period
  const { data: previous } = await supabase
    .from('sales')
    .select('platform, amount')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', prevFrom)
    .lt('sale_date', fromDate);

  // Aggregate both periods
  const aggregate = (sales) => {
    const totals = {};
    for (const s of (sales || [])) {
      totals[s.platform] = (totals[s.platform] || 0) + Number(s.amount);
    }
    return totals;
  };

  const curr = aggregate(current);
  const prev = aggregate(previous);

  // Build comparison for every platform
  const comparison = PLATFORM_LIST.map(platform => {
    const currentRevenue  = curr[platform] || 0;
    const previousRevenue = prev[platform] || 0;
    const change = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100 * 10) / 10
      : null;

    return {
      platform,
      current_revenue:  Math.round(currentRevenue  * 100) / 100,
      previous_revenue: Math.round(previousRevenue * 100) / 100,
      change_pct: change,
      trend: change === null ? 'new'
           : change > 0     ? 'up'
           : change < 0     ? 'down'
           : 'flat',
    };
  }).sort((a, b) => b.current_revenue - a.current_revenue);

  return { period, comparison };
}
