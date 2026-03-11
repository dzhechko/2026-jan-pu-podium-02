import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ReviewService } from './service.js';
import { submitReviewSchema, listReviewsSchema } from './schema.js';

export async function reviewRoutes(
  app: FastifyInstance,
  reviewService: ReviewService,
  authenticate: (request: FastifyRequest, reply: any) => Promise<void>,
) {
  // Public routes (no auth) — accessed by customers from SMS link

  app.get('/api/reviews/form/:token', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const result = await reviewService.getFormData(token);

    if ('error' in result) {
      return reply.status(result.status ?? 400).send({ error: { code: result.error } });
    }
    return result.data;
  });

  app.post('/api/reviews/submit/:token', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const parsed = submitReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    const result = await reviewService.submitReview(token, parsed.data);
    if ('error' in result) {
      return reply.status(result.status ?? 400).send({ error: { code: result.error } });
    }
    return result.data;
  });

  app.get('/api/optout/:token', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const result = await reviewService.optOut(token);

    if ('error' in result) {
      return reply.status(result.status ?? 400).send({ error: { code: result.error } });
    }
    return result.data;
  });

  // Admin routes (auth required)

  app.get('/api/reviews', {
    preHandler: [authenticate],
  }, async (request) => {
    const parsed = listReviewsSchema.parse(request.query);
    return reviewService.listReviews(request.user!.sub, parsed);
  });
}
