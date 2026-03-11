import type { FastifyInstance } from 'fastify';
import { AuthService, AuthError } from './service.js';
import { registerSchema, loginSchema, refreshSchema } from './schema.js';

export async function authRoutes(app: FastifyInstance, authService: AuthService) {
  // Rate limit login/register more strictly
  const authRateLimit = {
    max: 5,
    timeWindow: '15 minutes',
  };

  app.post('/api/auth/register', {
    config: { rateLimit: authRateLimit },
  }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    try {
      const result = await authService.register(parsed.data);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/api/auth/login', {
    config: { rateLimit: authRateLimit },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    try {
      const result = await authService.login(parsed.data);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    try {
      const result = await authService.refresh(parsed.data.refresh_token);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
}
