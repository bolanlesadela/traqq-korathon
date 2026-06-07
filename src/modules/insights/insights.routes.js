import { Router } from 'express';
import * as insightsController from './insights.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { generalLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.use(authMiddleware);
router.use(generalLimiter);

router.get('/',              insightsController.getInsights);
router.get('/unread-count',  insightsController.getUnreadCount);
router.post('/generate',     insightsController.generateInsights);
router.patch('/:id/read',    insightsController.markRead);

export default router;
