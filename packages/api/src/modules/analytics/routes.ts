import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AnalyticsService } from './service.js';
import { dashboardQuerySchema } from './schema.js';

export async function analyticsRoutes(
  app: FastifyInstance,
  analyticsService: AnalyticsService,
  authenticate: (request: FastifyRequest, reply: any) => Promise<void>,
) {
  app.get('/api/analytics/dashboard', {
    preHandler: [authenticate],
  }, async (request) => {
    const parsed = dashboardQuerySchema.parse(request.query);
    return analyticsService.getDashboard(request.user!.sub, parsed);
  });

  app.get('/api/analytics/channels', {
    preHandler: [authenticate],
  }, async (request) => {
    const parsed = dashboardQuerySchema.parse(request.query);
    return analyticsService.getChannelBreakdown(request.user!.sub, parsed);
  });
}
