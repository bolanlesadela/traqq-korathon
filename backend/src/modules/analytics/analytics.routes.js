import { Router } from 'express';
import * as analyticsController from './analytics.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { generalLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.use(authMiddleware);
router.use(generalLimiter);

// All accept ?period=today|week|month (defaults to month)
router.get('/overview',         analyticsController.getOverview);
router.get('/by-platform',      analyticsController.getRevenueByPlatform);
router.get('/timeline',         analyticsController.getTimeline);
router.get('/platform-compare', analyticsController.comparePlatforms);

export default router;
