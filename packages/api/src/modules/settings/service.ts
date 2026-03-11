import type { PrismaClient } from '@prisma/client';
import type { UpdateSettingsInput } from './schema.js';
import { extractYandexOrgId } from './schema.js';

export class SettingsService {
  constructor(private prisma: PrismaClient) {}

  async getSettings(adminId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    return {
      company_name: admin.companyName,
      yandex_maps_url: admin.yandexMapsUrl,
      yandex_org_id: admin.yandexOrgId,
      discount_percent: admin.discountPercent,
      discount_text: admin.discountText,
    };
  }

  async updateSettings(adminId: string, input: UpdateSettingsInput) {
    const data: Record<string, unknown> = {};

    if (input.company_name !== undefined) data.companyName = input.company_name;
    if (input.discount_percent !== undefined) data.discountPercent = input.discount_percent;
    if (input.discount_text !== undefined) data.discountText = input.discount_text;

    if (input.yandex_maps_url !== undefined) {
      data.yandexMapsUrl = input.yandex_maps_url;
      data.yandexOrgId = extractYandexOrgId(input.yandex_maps_url);
    }

    const admin = await this.prisma.admin.update({
      where: { id: adminId },
      data,
    });

    return {
      company_name: admin.companyName,
      yandex_maps_url: admin.yandexMapsUrl,
      yandex_org_id: admin.yandexOrgId,
      discount_percent: admin.discountPercent,
      discount_text: admin.discountText,
    };
  }
}
