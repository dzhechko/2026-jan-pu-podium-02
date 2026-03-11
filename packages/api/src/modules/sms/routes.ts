import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ReviewRequestService } from './service.js';
import { sendReviewRequestsSchema, listReviewRequestsSchema } from './schema.js';

export async function smsRoutes(
  app: FastifyInstance,
  reviewRequestService: ReviewRequestService,
  authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>,
) {
  app.post('/api/review-requests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const parsed = sendReviewRequestsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    const result = await reviewRequestService.sendReviewRequests(
      request.user!.sub,
      parsed.data.client_ids,
    );
    return result;
  });

  app.get('/api/review-requests', {
    preHandler: [authenticate],
  }, async (request) => {
    const parsed = listReviewRequestsSchema.parse(request.query);
    return reviewRequestService.listReviewRequests(request.user!.sub, parsed);
  });
}
