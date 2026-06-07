import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateLinkSchema,
} from './auth.schema.js';

const router = Router();

// Public routes — rate limited (10 req / 15 min per IP)
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login',    authLimiter, validate(loginSchema),    authController.login);
router.post('/refresh',  authLimiter, validate(refreshSchema),  authController.refresh);
router.post('/logout',   authController.logout); // no auth required — token may be expired

// Protected routes — require valid JWT
router.get('/me',           authMiddleware, authController.getMe);
router.patch('/update-link', authMiddleware, validate(updateLinkSchema), authController.updateLink);

export default router;
