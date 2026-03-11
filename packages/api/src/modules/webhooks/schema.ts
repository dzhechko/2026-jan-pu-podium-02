import { z } from 'zod';

export const webhookParamsSchema = z.object({
  adminId: z
    .string()
    .uuid('adminId must be a valid UUID'),
});

export const maxWebhookParamsSchema = z.object({
  adminId: z
    .string()
    .uuid('adminId must be a valid UUID'),
  token: z
    .string()
    .length(64, 'token must be 64 hex characters'),
});

export const telegramWebhookBodySchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      from: z
        .object({
          id: z.number().int(),
          first_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.number().int(),
        type: z.enum(['private', 'group', 'supergroup', 'channel']),
      }),
      text: z.string().max(4096).optional(),
      date: z.number().int(),
    })
    .optional(),
});

/**
 * Max sends `bot_started` events when a user opens a bot via deep link
 * (https://max.ru/{botName}?start={payload}). The payload is in the
 * `payload` field, not in message text like Telegram's /start.
 *
 * Max also sends `message_created` for regular messages.
 */
export const maxWebhookBodySchema = z.object({
  update_type: z.string(),
  timestamp: z.number().int(),
  // bot_started event fields
  chat_id: z.number().int().optional(),
  user: z.object({
    user_id: z.number().int(),
    name: z.string().optional(),
  }).optional(),
  payload: z.string().max(128).optional(),
  // message_created event fields (kept for future use)
  message: z
    .object({
      sender: z.object({
        user_id: z.number().int(),
      }),
      body: z.object({
        text: z.string().max(4096),
      }),
      recipient: z.object({
        chat_id: z.number().int(),
      }),
    })
    .optional(),
});

export type WebhookParams = z.infer<typeof webhookParamsSchema>;
export type TelegramWebhookBody = z.infer<typeof telegramWebhookBodySchema>;
export type MaxWebhookBody = z.infer<typeof maxWebhookBodySchema>;
