import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ReviewRequestService } from './service.js';
import { SmsTemplateService } from './template-service.js';
import {
  sendReviewRequestsSchema,
  listReviewRequestsSchema,
  upsertSmsTemplateSchema,
  deleteSmsTemplateParamsSchema,
} from './schema.js';

export async function smsRoutes(
  app: FastifyInstance,
  reviewRequestService: ReviewRequestService,
  authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>,
  smsTemplateService?: SmsTemplateService,
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

  // SMS Template routes
  if (smsTemplateService) {
    app.put('/api/sms-templates', {
      preHandler: [authenticate],
    }, async (request, reply) => {
      const parsed = upsertSmsTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
        });
      }

      try {
        const template = await smsTemplateService.upsertTemplate(
          request.user!.sub,
          parsed.data.reminder_number,
          parsed.data.message_template,
        );
        return {
          id: template.id,
          reminder_number: template.reminderNumber,
          message_template: template.messageTemplate,
          created_at: template.createdAt.toISOString(),
        };
      } catch (err) {
        return reply.status(400).send({
          error: { code: 'VALIDATION', message: String(err instanceof Error ? err.message : err) },
        });
      }
    });

    app.get('/api/sms-templates', {
      preHandler: [authenticate],
    }, async (request) => {
      return smsTemplateService.listTemplates(request.user!.sub);
    });

    app.delete('/api/sms-templates/:id', {
      preHandler: [authenticate],
    }, async (request, reply) => {
      const parsed = deleteSmsTemplateParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION', message: 'Invalid template ID' },
        });
      }

      try {
        await smsTemplateService.deleteTemplate(request.user!.sub, parsed.data.id);
        return reply.status(204).send();
      } catch (err) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: String(err instanceof Error ? err.message : err) },
        });
      }
    });
  }
}
