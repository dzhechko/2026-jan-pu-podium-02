import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { AuthService } from './modules/auth/service.js';
import { authRoutes } from './modules/auth/routes.js';
import { createAuthMiddleware } from './modules/auth/middleware.js';

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

// Health check
app.get('/api/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Auth routes
await authRoutes(app, authService);

// Graceful shutdown
app.addHook('onClose', async () => {
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
