import { Router } from 'express';
import * as salesController from './sales.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { generalLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { manualSaleSchema } from './sales.schema.js';

const router = Router();

// All sales routes require authentication
router.use(authMiddleware);
router.use(generalLimiter);

router.get('/',              salesController.getSales);
router.get('/export',        salesController.exportSales);   // before /:id or it matches 'export' as an id
router.get('/:id',           salesController.getSale);
router.post('/manual',       validate(manualSaleSchema), salesController.createSale);
router.delete('/:id',        salesController.deleteSale);

export default router;
