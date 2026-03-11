import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { AuthService } from './modules/auth/service.js';
import { authRoutes } from './modules/auth/routes.js';
import { createAuthMiddleware } from './modules/auth/middleware.js';
import { SettingsService } from './modules/settings/service.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { EncryptionService } from './services/encryption.js';
import { ClientsService } from './modules/clients/service.js';
import { clientsRoutes } from './modules/clients/routes.js';
import { SmscService } from './services/smsc.js';
import { ReviewRequestService } from './modules/sms/service.js';
import { SmsTemplateService } from './modules/sms/template-service.js';
import { smsRoutes } from './modules/sms/routes.js';
import { ReviewService } from './modules/reviews/service.js';
import { reviewRoutes } from './modules/reviews/routes.js';
import { LlmService } from './services/llm.js';
import { SentimentService } from './modules/sentiment/service.js';
import { AnalyticsService } from './modules/analytics/service.js';
import { analyticsRoutes } from './modules/analytics/routes.js';
import { ReminderService } from './services/reminder.js';
import { MessageGateway } from './services/message-gateway.js';

const env = loadEnv();
const prisma = new PrismaClient();
const authService = new AuthService(prisma, env.JWT_SECRET, env.JWT_REFRESH_SECRET);
export const authenticate = createAuthMiddleware(authService);

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  },
});

// Plugins
await app.register(cors, {
  origin: [env.APP_URL, env.PWA_URL],
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production',
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(cookie, {
  secret: env.JWT_SECRET,
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Health check
app.get('/api/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Auth routes
await authRoutes(app, authService);

// Shared services
const encryptionService = new EncryptionService(env.ENCRYPTION_KEY);

// Settings routes
const settingsService = new SettingsService(prisma, encryptionService);
await settingsRoutes(app, settingsService, authenticate);

// Clients routes
const clientsService = new ClientsService(prisma, encryptionService);
await clientsRoutes(app, clientsService, authenticate);

// SMS / Review Request routes
const smscService = new SmscService(env.SMSC_LOGIN, env.SMSC_PASSWORD, env.SMSC_SENDER);
const smsTemplateService = new SmsTemplateService(prisma);
const messageGateway = new MessageGateway(smscService, prisma, encryptionService, {
  info: (msg) => app.log.info(msg),
  warn: (msg) => app.log.warn(msg),
  error: (msg) => app.log.error(msg),
});
const reviewRequestService = new ReviewRequestService(prisma, messageGateway, encryptionService, env.PWA_URL, smsTemplateService);
await smsRoutes(app, reviewRequestService, authenticate, smsTemplateService);

// Sentiment analysis
const llmService = new LlmService(env.ANTHROPIC_API_KEY);
const sentimentService = new SentimentService(prisma, llmService);

// Review routes (public + admin)
const reviewService = new ReviewService(prisma);
reviewService.setSentimentService(sentimentService);
await reviewRoutes(app, reviewService, authenticate);

// Analytics routes
const analyticsService = new AnalyticsService(prisma);
await analyticsRoutes(app, analyticsService, authenticate);

// Cascade reminder scheduler
const reminderService = new ReminderService(prisma, messageGateway, encryptionService, env.PWA_URL, smsTemplateService, {
  info: (msg) => app.log.info(msg),
  error: (msg, err) => app.log.error({ err }, msg),
});
reminderService.startScheduler();

// Graceful shutdown
app.addHook('onClose', async () => {
  reminderService.stopScheduler();
  await prisma.$disconnect();
});

// Start
const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;
