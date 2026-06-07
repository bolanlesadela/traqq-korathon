import { apiResponse } from '../../utils/apiResponse.js';
import * as insightsService from './insights.service.js';

export async function getInsights(req, res) {
  const data = await insightsService.getInsights(req.user.id);
  return apiResponse.success(res, { data });
}

export async function generateInsights(req, res) {
  const generated = await insightsService.triggerGeneration(req.user.id);
  return apiResponse.success(res, {
    message: generated.length > 0
      ? `${generated.length} new insight(s) generated`
      : 'No new insights at this time',
    data: { generated },
  });
}

export async function markRead(req, res) {
  await insightsService.markRead(req.user.id, req.params.id);
  return apiResponse.success(res, { message: 'Marked as read' });
}

export async function getUnreadCount(req, res) {
  const count = await insightsService.getUnreadCount(req.user.id);
  return apiResponse.success(res, { data: { unread: count } });
}
