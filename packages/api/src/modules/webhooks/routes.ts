import type { FastifyInstance } from 'fastify';
import { WebhookService } from './service.js';
import {
  webhookParamsSchema,
  telegramWebhookBodySchema,
  maxWebhookBodySchema,
} from './schema.js';

/**
 * Public webhook routes — no authentication middleware.
 * Both endpoints ALWAYS return 200 { ok: true } regardless of processing outcome.
 * This is required by Telegram (retries on non-200) and consistent for Max.
 */
export async function webhookRoutes(
  app: FastifyInstance,
  webhookService: WebhookService,
): Promise<void> {
  /**
   * POST /api/webhooks/telegram/:adminId
   *
   * Receives updates from Telegram Bot API.
   * Validates X-Telegram-Bot-Api-Secret-Token before processing.
   * Responds 200 immediately; linking and confirmation run async.
   */
  app.post('/api/webhooks/telegram/:adminId', async (request, reply) => {
    // Validate URL param
    const paramsParsed = webhookParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      // Silent: don't reveal validation details to potential scanners
      request.log.warn({ params: request.params }, 'telegram webhook: invalid adminId param');
      return reply.status(200).send({ ok: true });
    }

    const { adminId } = paramsParsed.data;

    // Validate Telegram secret token
    const secretToken = (request.headers['x-telegram-bot-api-secret-token'] as string) ?? '';
    if (!webhookService.verifyTelegramSecret(adminId, secretToken)) {
      request.log.warn({ adminId }, 'telegram webhook: invalid secret token');
      return reply.status(200).send({ ok: true });
    }

    // Parse body
    const bodyParsed = telegramWebhookBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      request.log.warn({ adminId, error: bodyParsed.error.message }, 'telegram webhook: invalid body');
      return reply.status(200).send({ ok: true });
    }

    // Respond immediately — Telegram requires a fast acknowledgement
    void reply.status(200).send({ ok: true });

    // Async processing (fire and forget)
    webhookService.processTelegramUpdate(adminId, bodyParsed.data).catch((err: unknown) => {
      request.log.error({ adminId, error: String(err) }, 'telegram webhook: processTelegramUpdate threw');
    });
  });

  /**
   * POST /api/webhooks/max/:adminId
   *
   * Receives updates from Max Bot API.
   * No secret token mechanism available from Max — security relies on
   * obscure adminId UUID in URL + rate limiting + input validation.
   * Responds 200 immediately; linking and confirmation run async.
   */
  app.post('/api/webhooks/max/:adminId', async (request, reply) => {
    // Validate URL param
    const paramsParsed = webhookParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      request.log.warn({ params: request.params }, 'max webhook: invalid adminId param');
      return reply.status(200).send({ ok: true });
    }

    const { adminId } = paramsParsed.data;

    // Parse body
    const bodyParsed = maxWebhookBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      request.log.warn({ adminId, error: bodyParsed.error.message }, 'max webhook: invalid body');
      return reply.status(200).send({ ok: true });
    }

    // Respond immediately
    void reply.status(200).send({ ok: true });

    // Async processing (fire and forget)
    webhookService.processMaxUpdate(adminId, bodyParsed.data).catch((err: unknown) => {
      request.log.error({ adminId, error: String(err) }, 'max webhook: processMaxUpdate threw');
    });
  });
}
