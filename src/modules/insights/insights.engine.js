import { supabase } from '../../config/supabase.js';
import { INSIGHT_TYPES, PLATFORM_LIST } from '../../config/constants.js';

// ─── DATA FETCHER ─────────────────────────────────────────────────────────────

/**
 * Pull everything the rules need in two queries.
 * Keeping data fetching separate from rule logic makes rules testable.
 */
async function fetchVendorData(vendorId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sales } = await supabase
    .from('sales')
    .select('amount, platform, sale_date, currency')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success')
    .eq('is_deleted', false)
    .gte('sale_date', thirtyDaysAgo)
    .order('sale_date', { ascending: false });

  const { count: totalSalesEver } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'success');

  return {
    sales: sales || [],
    totalSalesEver: totalSalesEver || 0,
    sevenDaysAgo,
    fourteenDaysAgo,
    thirtyDaysAgo,
  };
}

// ─── RULE HELPERS ─────────────────────────────────────────────────────────────

function groupByPlatform(sales) {
  const totals = {};
  for (const s of sales) {
    if (!totals[s.platform]) totals[s.platform] = { revenue: 0, sales: 0 };
    totals[s.platform].revenue += Number(s.amount);
    totals[s.platform].sales   += 1;
  }
  return totals;
}

function filterByDate(sales, fromDate) {
  return sales.filter(s => s.sale_date >= fromDate);
}

function totalRevenue(sales) {
  return sales.reduce((sum, s) => sum + Number(s.amount), 0);
}

function formatNGN(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`;
}

// ─── RULES ────────────────────────────────────────────────────────────────────

/**
 * RULE 1 — First Sale
 * Fires once, on the vendor's very first ever sale.
 * Highest priority — check this before anything else.
 */
function ruleFirstSale({ totalSalesEver, sales }) {
  if (totalSalesEver !== 1) return null;
  const sale = sales[0];
  if (!sale) return null;

  return {
    insight_type: INSIGHT_TYPES.FIRST_SALE,
    message: `Your first sale just came in from ${sale.platform} — ${formatNGN(sale.amount)}. You're live on Traqq. 🎉`,
    data_snapshot: { platform: sale.platform, amount: sale.amount },
    period: 'daily',
  };
}

/**
 * RULE 2 — Top Platform
 * Fires when one platform drives >50% of weekly revenue
 * and has at least 2 sales (avoids noise from one-off transactions).
 */
function ruleTopPlatform({ sales, sevenDaysAgo }) {
  const weeklySales = filterByDate(sales, sevenDaysAgo);
  if (weeklySales.length < 2) return null;

  const weeklyTotal = totalRevenue(weeklySales);
  if (weeklyTotal === 0) return null;

  const byPlatform = groupByPlatform(weeklySales);
  const sorted = Object.entries(byPlatform).sort(([, a], [, b]) => b.revenue - a.revenue);
  const [topPlatform, topData] = sorted[0];

  const percentage = Math.round((topData.revenue / weeklyTotal) * 100);
  if (percentage < 50) return null;

  return {
    insight_type: INSIGHT_TYPES.TOP_PLATFORM,
    message: `${capitalise(topPlatform)} is driving ${percentage}% of your revenue this week — ${formatNGN(topData.revenue)} from ${topData.sales} sale${topData.sales > 1 ? 's' : ''}.`,
    data_snapshot: { platform: topPlatform, revenue: topData.revenue, percentage, period: 'weekly' },
    period: 'weekly',
  };
}

/**
 * RULE 3 — Revenue Drop
 * Fires when this week's revenue is 30%+ below last week's.
 * Minimum ₦1,000 last week to avoid noise.
 */
function ruleRevenueDrop({ sales, sevenDaysAgo, fourteenDaysAgo }) {
  const thisWeek = filterByDate(sales, sevenDaysAgo);
  const lastWeek = sales.filter(s => s.sale_date >= fourteenDaysAgo && s.sale_date < sevenDaysAgo);

  const thisRevenue = totalRevenue(thisWeek);
  const lastRevenue = totalRevenue(lastWeek);

  if (lastRevenue < 1000) return null; // not enough history
  const drop = ((lastRevenue - thisRevenue) / lastRevenue) * 100;
  if (drop < 30) return null;

  const dropPct = Math.round(drop);

  return {
    insight_type: INSIGHT_TYPES.REVENUE_DROP,
    message: `Your revenue dropped ${dropPct}% this week (${formatNGN(thisRevenue)}) compared to last week (${formatNGN(lastRevenue)}). Consider posting more or running a promo.`,
    data_snapshot: { this_week: thisRevenue, last_week: lastRevenue, drop_pct: dropPct },
    period: 'weekly',
  };
}

/**
 * RULE 4 — Inactive Platform
 * Fires when a platform that made sales in the past 30 days
 * has had zero sales in the last 10 days.
 * Tells vendor: stop wasting time posting there.
 */
function ruleInactivePlatform({ sales, sevenDaysAgo, thirtyDaysAgo }) {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const activeBefore  = new Set(filterByDate(sales, thirtyDaysAgo).map(s => s.platform));
  const activeRecent  = new Set(filterByDate(sales, tenDaysAgo).map(s => s.platform));

  const inactive = [...activeBefore].filter(p => !activeRecent.has(p) && p !== 'unknown');
  if (inactive.length === 0) return null;

  const platform = inactive[0]; // surface one at a time

  return {
    insight_type: INSIGHT_TYPES.INACTIVE_PLATFORM,
    message: `You haven't made a sale from ${capitalise(platform)} in 10 days. It may not be worth posting there right now — focus on what's working.`,
    data_snapshot: { platform, days_inactive: 10 },
    period: 'weekly',
  };
}

/**
 * RULE 5 — Best Sales Day
 * Fires when a vendor has 14+ days of data and one weekday
 * consistently outperforms others (>30% more revenue than average).
 * Tells vendor: post the night before your best day.
 */
function ruleBestDay({ sales, fourteenDaysAgo }) {
  const recentSales = filterByDate(sales, fourteenDaysAgo);
  if (recentSales.length < 5) return null;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = {};

  for (const s of recentSales) {
    const day = new Date(s.sale_date).getDay(); // 0=Sun … 6=Sat
    if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 };
    byDay[day].revenue += Number(s.amount);
    byDay[day].count   += 1;
  }

  const entries = Object.entries(byDay);
  if (entries.length < 3) return null; // need at least 3 different days

  const avgRevenue = Object.values(byDay).reduce((sum, d) => sum + d.revenue, 0) / entries.length;
  const sorted     = entries.sort(([, a], [, b]) => b.revenue - a.revenue);
  const [bestDayNum, bestData] = sorted[0];

  const outperformPct = Math.round(((bestData.revenue - avgRevenue) / avgRevenue) * 100);
  if (outperformPct < 30) return null;

  const bestDayName = DAYS[bestDayNum];
  const prevDayName = DAYS[(bestDayNum - 1 + 7) % 7];

  return {
    insight_type: INSIGHT_TYPES.BEST_DAY,
    message: `${bestDayName} is your best sales day — ${outperformPct}% above your daily average. Try posting on ${prevDayName} night to catch early buyers.`,
    data_snapshot: { best_day: bestDayName, outperform_pct: outperformPct, revenue: bestData.revenue },
    period: 'monthly',
  };
}

// ─── DEDUPLICATION ────────────────────────────────────────────────────────────

/**
 * Don't insert the same insight type if one already exists from today.
 * Prevents the dashboard from flooding with identical insights.
 */
async function alreadyGeneratedToday(vendorId, insightType) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('insights')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('insight_type', insightType)
    .gte('generated_at', todayStart.toISOString())
    .maybeSingle();

  return !!data;
}

async function saveInsight(vendorId, insight) {
  if (await alreadyGeneratedToday(vendorId, insight.insight_type)) return;

  await supabase.from('insights').insert({
    vendor_id: vendorId,
    ...insight,
  });
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

/**
 * Run all rules for a vendor and persist any that fire.
 * Called async/non-blocking from the webhook service after each sale.
 * Also callable on-demand from the insights API route.
 */
export async function generateInsights(vendorId) {
  const data = await fetchVendorData(vendorId);

  // Rules ordered by priority — first sale checked first
  const rules = [
    ruleFirstSale,
    ruleTopPlatform,
    ruleRevenueDrop,
    ruleInactivePlatform,
    ruleBestDay,
  ];

  const results = [];
  for (const rule of rules) {
    try {
      const insight = rule(data);
      if (insight) {
        await saveInsight(vendorId, insight);
        results.push(insight.insight_type);
      }
    } catch (err) {
      // One failing rule must never block the others
      console.error(`[Insights] Rule ${rule.name} failed:`, err.message);
    }
  }

  if (results.length > 0) {
    console.log(`[Insights] Generated for vendor ${vendorId}:`, results.join(', '));
  }

  return results;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
