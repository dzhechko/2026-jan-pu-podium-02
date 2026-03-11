import { z } from 'zod';

export const channelEnum = z.enum(['sms', 'telegram', 'max']);

export const createClientSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  phone: z.string().regex(/^\+7\d{10}$/, 'Формат телефона: +7XXXXXXXXXX'),
  email: z.string().email('Некорректный email').optional(),
  telegram_chat_id: z.string().regex(/^\d+$/, 'telegram_chat_id must be numeric').optional(),
  max_chat_id: z.string().optional(),
  preferred_channel: channelEnum.optional().default('sms'),
});

export const listClientsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsSchema>;
