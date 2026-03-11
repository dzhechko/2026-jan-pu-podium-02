import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SettingsService } from './service.js';
import { updateSettingsSchema } from './schema.js';

export async function settingsRoutes(
  app: FastifyInstance,
  settingsService: SettingsService,
  authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>,
) {
  app.get('/api/settings', {
    preHandler: [authenticate],
  }, async (request) => {
    const settings = await settingsService.getSettings(request.user!.sub);
    return { data: settings };
  });

  app.put('/api/settings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    const settings = await settingsService.updateSettings(request.user!.sub, parsed.data);
    return { data: settings };
  });
}
