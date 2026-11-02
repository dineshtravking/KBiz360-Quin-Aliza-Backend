import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';
import routes from '#routes/index.js';
import { auditTrail } from '#modules/audit-logs/index.js';
import { notFound } from '#shared/middlewares/notFound.middleware.js';
import { errorHandler } from '#shared/middlewares/error.middleware.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Security and cross-origin rules
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => env.isTest,
    }),
  );

  // 2. Request logging and body parsing
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.endsWith('/health') } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 3. Audit trail of every successful change
  app.use(auditTrail);

  // 4. API routes
  app.use(env.API_PREFIX, routes);

  // 5. Unknown routes and errors — always last
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
