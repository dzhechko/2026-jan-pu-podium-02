import type { PrismaClient } from '@prisma/client';
import type { UpdateSettingsInput } from './schema.js';
import { extractYandexOrgId } from './schema.js';
import type { EncryptionService } from '../../services/encryption.js';
import { TelegramProvider } from '../../services/telegram.js';
import { MaxProvider } from '../../services/max.js';
import type { WebhookService } from '../webhooks/service.js';

export class SettingsService {
  private webhookService?: WebhookService;

  constructor(
    private prisma: PrismaClient,
    private encryption: EncryptionService,
  ) {}

  setWebhookService(ws: WebhookService) {
    this.webhookService = ws;
  }

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

    // Handle channel token updates
    if (input.telegram_bot_token !== undefined) {
      await this.updateTelegramToken(data, input.telegram_bot_token);
    }

    if (input.max_bot_token !== undefined) {
      await this.updateMaxToken(data, input.max_bot_token);
    }

    const admin = await this.prisma.admin.update({
      where: { id: adminId },
      data,
    });

    // Register webhooks after token save
    if (this.webhookService) {
      if (input.telegram_bot_token) {
        this.webhookService.registerWebhook(admin.id, 'telegram', input.telegram_bot_token)
          .catch((err) => console.warn('Telegram webhook registration failed:', err));
      }
      if (input.max_bot_token) {
        this.webhookService.registerWebhook(admin.id, 'max', input.max_bot_token)
          .catch((err) => console.warn('Max webhook registration failed:', err));
      }
    }

    // Include channel status in response
    const channels = await this.getChannels(adminId);

    return {
      company_name: admin.companyName,
      yandex_maps_url: admin.yandexMapsUrl,
      yandex_org_id: admin.yandexOrgId,
      discount_percent: admin.discountPercent,
      discount_text: admin.discountText,
      ...channels,
    };
  }

  async getChannels(adminId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });

    const channels: Array<{
      type: string;
      configured: boolean;
      bot_username?: string;
      bot_name?: string;
    }> = [
      { type: 'sms', configured: true },
    ];

    if (admin.telegramBotTokenEncrypted) {
      channels.push({
        type: 'telegram',
        configured: true,
        bot_username: admin.telegramBotUsername ?? undefined,
      });
    } else {
      channels.push({ type: 'telegram', configured: false });
    }

    if (admin.maxBotTokenEncrypted) {
      channels.push({
        type: 'max',
        configured: true,
        bot_name: admin.maxBotName ?? undefined,
      });
    } else {
      channels.push({ type: 'max', configured: false });
    }

    return { channels };
  }

  private async updateTelegramToken(data: Record<string, unknown>, token: string): Promise<void> {
    if (!token) {
      // Remove Telegram config
      data.telegramBotTokenEncrypted = null;
      data.telegramBotUsername = null;
      return;
    }

    // Validate token
    const provider = new TelegramProvider(token);
    const valid = await provider.validateCredentials();
    if (!valid) {
      throw new Error('Invalid Telegram bot token');
    }

    // Get bot info
    const info = await provider.getBotInfo();
    data.telegramBotTokenEncrypted = this.encryption.encrypt(token);
    data.telegramBotUsername = info?.username ?? null;
  }

  private async updateMaxToken(data: Record<string, unknown>, token: string): Promise<void> {
    if (!token) {
      // Remove Max config
      data.maxBotTokenEncrypted = null;
      data.maxBotName = null;
      return;
    }

    // Validate token
    const provider = new MaxProvider(token);
    const valid = await provider.validateCredentials();
    if (!valid) {
      throw new Error('Invalid Max bot token');
    }

    // Get bot info
    const info = await provider.getBotInfo();
    data.maxBotTokenEncrypted = this.encryption.encrypt(token);
    data.maxBotName = info?.name ?? null;
  }
}
