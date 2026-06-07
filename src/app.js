import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter       from './modules/auth/auth.routes.js';
import attributionRouter from './modules/attribution/attribution.routes.js';
import webhookRouter    from './modules/webhook/webhook.routes.js';
import salesRouter      from './modules/sales/sales.routes.js';
import analyticsRouter  from './modules/analytics/analytics.routes.js';
import insightsRouter   from './modules/insights/insights.routes.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.isDev
    ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5500']
    : [env.frontendUrl],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// CRITICAL: raw body for webhook before json parser
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'traqq-backend',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ─── ALL ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/webhook',   webhookRouter);
app.use('/api/sales',     salesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/insights',  insightsRouter);
app.use('/pay',           attributionRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});
app.use(errorHandler);

export default app;
