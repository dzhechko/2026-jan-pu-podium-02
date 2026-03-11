import { z } from 'zod';

export const channelEnum = z.enum(['sms', 'telegram', 'max']);

export const sendReviewRequestsSchema = z.object({
  client_ids: z.array(z.string().uuid()).min(1, 'Выберите хотя бы одного клиента'),
  channel: channelEnum.optional(),
});

export const listReviewRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

export const upsertSmsTemplateSchema = z.object({
  reminder_number: z.number().int().min(0).max(4),
  message_template: z
    .string()
    .min(10, 'Минимум 10 символов')
    .max(4096, 'Максимум 4096 символов')
    .refine((s) => s.includes('{link}'), { message: 'Шаблон должен содержать {link}' })
    .refine((s) => s.includes('{optout}'), { message: 'Шаблон должен содержать {optout}' }),
  channel: channelEnum.optional().default('sms'),
});

export const deleteSmsTemplateParamsSchema = z.object({
  id: z.string().uuid(),
});

export type SendReviewRequestsInput = z.infer<typeof sendReviewRequestsSchema>;
export type ListReviewRequestsQuery = z.infer<typeof listReviewRequestsSchema>;
export type UpsertSmsTemplateInput = z.infer<typeof upsertSmsTemplateSchema>;
