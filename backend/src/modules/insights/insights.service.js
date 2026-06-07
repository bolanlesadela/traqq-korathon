// ─── SERVICE ──────────────────────────────────────────────────────────────────
import { supabase } from '../../config/supabase.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateInsights } from './insights.engine.js';

export async function getInsights(vendorId) {
  const { data, error } = await supabase
    .from('insights')
    .select('id, insight_type, message, data_snapshot, period, is_read, generated_at')
    .eq('vendor_id', vendorId)
    .order('generated_at', { ascending: false })
    .limit(20);

  if (error) throw new AppError('Failed to fetch insights', 500);
  return data;
}

export async function triggerGeneration(vendorId) {
  return generateInsights(vendorId);
}

export async function markRead(vendorId, insightId) {
  const { error } = await supabase
    .from('insights')
    .update({ is_read: true })
    .eq('id', insightId)
    .eq('vendor_id', vendorId); // ownership enforced

  if (error) throw new AppError('Failed to mark insight as read', 500);
}

export async function getUnreadCount(vendorId) {
  const { count, error } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('is_read', false);

  if (error) throw new AppError('Failed to fetch unread count', 500);
  return count || 0;
}
