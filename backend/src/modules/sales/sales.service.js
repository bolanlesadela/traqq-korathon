import { supabase } from '../../config/supabase.js';
import { AppError } from '../../middleware/errorHandler.js';
import { SALE_SOURCE, PAYMENT_STATUS } from '../../config/constants.js';

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

/**
 * Convert a named period to a UTC start date.
 * 'today' → start of today
 * 'week'  → 7 days ago
 * 'month' → 30 days ago
 */
function periodToFrom(period) {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === 'week') {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (period === 'month') {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

/**
 * List sales with filters and pagination.
 * All filters are optional — returns all sales if none provided.
 */
export async function listSales(vendorId, query) {
  const { platform, status, source, from, to, period, page, limit } = query;

  const offset = (page - 1) * limit;

  // Resolve date range — explicit from/to takes priority over named period
  const fromDate = from || periodToFrom(period);
  const toDate   = to   || null;

  let dbQuery = supabase
    .from('sales')
    .select(`
      id,
      platform,
      amount,
      currency,
      product_name,
      payment_status,
      source,
      korapay_ref,
      sale_date,
      created_at
    `, { count: 'exact' })
    .eq('vendor_id', vendorId)
    .eq('is_deleted', false)
    .order('sale_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (platform)  dbQuery = dbQuery.eq('platform', platform);
  if (status)    dbQuery = dbQuery.eq('payment_status', status);
  if (source)    dbQuery = dbQuery.eq('source', source);
  if (fromDate)  dbQuery = dbQuery.gte('sale_date', fromDate);
  if (toDate)    dbQuery = dbQuery.lte('sale_date', toDate);

  const { data, error, count } = await dbQuery;
  if (error) throw new AppError('Failed to fetch sales', 500);

  return {
    sales: data,
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get a single sale by ID.
 * Enforces ownership — vendors can only fetch their own sales.
 */
export async function getSaleById(vendorId, saleId) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      platform,
      amount,
      currency,
      product_name,
      payment_status,
      source,
      korapay_ref,
      session_id,
      sale_date,
      created_at
    `)
    .eq('id', saleId)
    .eq('vendor_id', vendorId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) throw new AppError('Failed to fetch sale', 500);
  if (!data) throw new AppError('Sale not found', 404);

  return data;
}

/**
 * Create a manual sale entry.
 * Used when a vendor made a sale outside of the Korapay link flow
 * (e.g. cash, direct bank transfer, in-person).
 */
export async function createManualSale(vendorId, body) {
  const { amount, platform, product_name, currency, sale_date } = body;

  const { data, error } = await supabase
    .from('sales')
    .insert({
      vendor_id: vendorId,
      platform,
      amount,
      currency: currency || 'NGN',
      product_name: product_name || null,
      payment_status: PAYMENT_STATUS.SUCCESS, // manual = already paid
      source: SALE_SOURCE.MANUAL,
      sale_date: sale_date || new Date().toISOString(),
    })
    .select('id, platform, amount, currency, product_name, sale_date, source')
    .single();

  if (error) throw new AppError('Failed to create sale', 500);
  return data;
}

/**
 * Soft delete a sale.
 * Never hard-delete financial records.
 * Enforces ownership — can't delete another vendor's sale.
 */
export async function deleteSale(vendorId, saleId) {
  // First confirm it exists and belongs to this vendor
  const { data: existing } = await supabase
    .from('sales')
    .select('id, source')
    .eq('id', saleId)
    .eq('vendor_id', vendorId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!existing) throw new AppError('Sale not found', 404);

  // Only manual sales can be deleted — auto sales are payment records
  if (existing.source === SALE_SOURCE.AUTO) {
    throw new AppError('Automatic sales cannot be deleted. Contact support if this is an error.', 403);
  }

  const { error } = await supabase
    .from('sales')
    .update({ is_deleted: true })
    .eq('id', saleId)
    .eq('vendor_id', vendorId);

  if (error) throw new AppError('Failed to delete sale', 500);
}

/**
 * Export sales as CSV string.
 * Returns raw CSV text — controller sets Content-Type and filename header.
 */
export async function exportSalesCSV(vendorId, query) {
  // Fetch all matching sales (no pagination for export)
  const { from, to, period, platform } = query;
  const fromDate = from || periodToFrom(period);

  let dbQuery = supabase
    .from('sales')
    .select('id, platform, amount, currency, product_name, payment_status, source, korapay_ref, sale_date')
    .eq('vendor_id', vendorId)
    .eq('is_deleted', false)
    .eq('payment_status', 'success')
    .order('sale_date', { ascending: false })
    .limit(5000); // cap export at 5000 rows

  if (platform)  dbQuery = dbQuery.eq('platform', platform);
  if (fromDate)  dbQuery = dbQuery.gte('sale_date', fromDate);
  if (to)        dbQuery = dbQuery.lte('sale_date', to);

  const { data, error } = await dbQuery;
  if (error) throw new AppError('Failed to export sales', 500);

  if (!data.length) return null;

  // Build CSV
  const headers = ['Date', 'Platform', 'Amount', 'Currency', 'Product', 'Source', 'Reference'];
  const rows = data.map(s => [
    new Date(s.sale_date).toLocaleDateString('en-NG'),
    s.platform,
    s.amount,
    s.currency,
    s.product_name || '',
    s.source,
    s.korapay_ref || '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csv;
}
