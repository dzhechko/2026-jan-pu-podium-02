import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ClientsService } from './service.js';
import { createClientSchema, listClientsSchema } from './schema.js';

const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB

export async function clientsRoutes(
  app: FastifyInstance,
  clientsService: ClientsService,
  authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>,
) {
  app.get('/api/clients', {
    preHandler: [authenticate],
  }, async (request) => {
    const parsed = listClientsSchema.parse(request.query);
    return clientsService.list(request.user!.sub, parsed);
  });

  app.post('/api/clients', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.errors[0].message },
      });
    }

    const client = await clientsService.create(request.user!.sub, parsed.data);
    return reply.status(201).send({ data: client });
  });

  app.post('/api/clients/import', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'CSV файл обязателен' },
      });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_CSV_SIZE) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'Файл превышает 10MB' },
      });
    }

    const result = await clientsService.importCsv(request.user!.sub, buffer.toString('utf8'));
    return result;
  });

  app.delete('/api/clients/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await clientsService.delete(request.user!.sub, id);
    return reply.status(204).send();
  });
}
