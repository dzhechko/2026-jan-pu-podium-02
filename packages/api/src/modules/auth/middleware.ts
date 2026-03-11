import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from './service.js';

export function createAuthMiddleware(authService: AuthService) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: { code: 'AUTH_REQUIRED', message: 'Требуется авторизация' },
      });
    }

    const token = authHeader.slice(7);
    try {
      const payload = await authService.verifyAccessToken(token);
      request.user = payload;
    } catch {
      return reply.status(401).send({
        error: { code: 'TOKEN_INVALID', message: 'Невалидный или просроченный токен' },
      });
    }
  };
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      email: string;
    };
  }
}
