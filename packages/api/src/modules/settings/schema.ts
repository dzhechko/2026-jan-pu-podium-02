import { z } from 'zod';

export const updateSettingsSchema = z.object({
  company_name: z.string().min(1, 'Название компании обязательно').optional(),
  yandex_maps_url: z.string().url('Некорректный URL').optional(),
  discount_percent: z.number().int().min(1).max(100).optional(),
  discount_text: z.string().max(500).optional(),
  telegram_bot_token: z.string().optional(),
  max_bot_token: z.string().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export function extractYandexOrgId(url: string): string | null {
  // https://yandex.ru/maps/org/company-name/123456789/
  const match1 = url.match(/\/org\/[^/]+\/(\d+)/);
  if (match1) return match1[1];

  // https://maps.yandex.ru/org/123456789
  const match2 = url.match(/\/org\/(\d+)/);
  if (match2) return match2[1];

  return null;
}
