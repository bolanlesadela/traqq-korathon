import { apiResponse } from '../../utils/apiResponse.js';
import * as analyticsService from './analytics.service.js';

const VALID_PERIODS = ['today', 'week', 'month'];
const safePeriod = (p) => VALID_PERIODS.includes(p) ? p : 'month';

export async function getOverview(req, res) {
  const data = await analyticsService.getOverview(req.user.id, safePeriod(req.query.period));
  return apiResponse.success(res, { data });
}

export async function getRevenueByPlatform(req, res) {
  const data = await analyticsService.getRevenueByPlatform(req.user.id, safePeriod(req.query.period));
  return apiResponse.success(res, { data });
}

export async function getTimeline(req, res) {
  const data = await analyticsService.getTimeline(req.user.id, safePeriod(req.query.period));
  return apiResponse.success(res, { data });
}

export async function comparePlatforms(req, res) {
  const data = await analyticsService.comparePlatforms(req.user.id, safePeriod(req.query.period));
  return apiResponse.success(res, { data });
}
