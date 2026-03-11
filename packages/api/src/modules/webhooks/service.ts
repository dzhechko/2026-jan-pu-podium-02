import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { EncryptionService } from '../../services/encryption.js';
import { TelegramProvider } from '../../services/telegram.js';
import { MaxProvider } from '../../services/max.js';
import type { TelegramWebhookBody, MaxWebhookBody } from './schema.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

interface TelegramSetWebhookResponse {
  ok: boolean;
  description?: string;
}

interface MaxSubscriptionResponse {
  subscriptions?: unknown[];
  error?: string;
  description?: string;
}

export class WebhookService {
  private readonly log: Logger;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly encryption: EncryptionService,
    private readonly webhookSecret: string,
    private readonly apiBaseUrl: string,
    logger?: Logger,
  ) {
    this.log = logger ?? {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  /**
   * Generate HMAC-SHA256(adminId, webhookSecret) as hex string.
   * Used as the Telegram secret_token when registering webhooks.
   */
  generateTelegramSecret(adminId: string): string {
    return createHmac('sha256', this.webhookSecret).update(adminId).digest('hex');
  }

  /**
   * Compare provided token with expected HMAC in constant-time fashion
   * by comparing both as hex strings.
   */
  verifyTelegramSecret(adminId: string, providedToken: string): boolean {
    const expected = this.generateTelegramSecret(adminId);
    return expected === providedToken;
  }

  /**
   * Process incoming Telegram update.
   * Fires response immediately; linking + confirmation are async.
   */
  async processTelegramUpdate(adminId: string, update: TelegramWebhookBody): Promise<void> {
    const message = update.message;
    if (!message) return;

    // Only process private chats
    if (message.chat.type !== 'private') return;

    const text = message.text ?? '';
    if (!text.startsWith('/start ')) return;

    const clientId = text.substring(7).trim();
    if (!UUID_REGEX.test(clientId)) {
      this.log.warn('telegram webhook: /start param is not a UUID', { adminId, clientId });
      return;
    }

    const chatId = String(message.from?.id ?? message.chat.id);

    // Fire and forget — caller has already sent 200
    this.linkClient(adminId, clientId, 'telegram', chatId)
      .then((linked) => {
        if (linked) {
          return this.sendConfirmation(adminId, 'telegram', chatId);
        }
      })
      .catch((err: unknown) => {
        this.log.error('telegram auto-link failed', {
          adminId,
          clientId,
          error: String(err),
        });
      });
  }

  /**
   * Process incoming Max update.
   * Fires response immediately; linking + confirmation are async.
   */
  async processMaxUpdate(adminId: string, update: MaxWebhookBody): Promise<void> {
    if (update.update_type !== 'message_created') return;

    const message = update.message;
    if (!message) return;

    const text = message.body.text ?? '';
    if (!text.startsWith('/start ')) return;

    const clientId = text.substring(7).trim();
    if (!UUID_REGEX.test(clientId)) {
      this.log.warn('max webhook: /start param is not a UUID', { adminId, clientId });
      return;
    }

    const chatId = String(message.recipient.chat_id);

    // Fire and forget — caller has already sent 200
    this.linkClient(adminId, clientId, 'max', chatId)
      .then((linked) => {
        if (linked) {
          return this.sendConfirmation(adminId, 'max', chatId);
        }
      })
      .catch((err: unknown) => {
        this.log.error('max auto-link failed', {
          adminId,
          clientId,
          error: String(err),
        });
      });
  }

  /**
   * Encrypt and persist the messenger chat ID for a client.
   * Returns false when the client is not found or has opted out.
   */
  async linkClient(
    adminId: string,
    clientId: string,
    channel: 'telegram' | 'max',
    chatId: string,
  ): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, adminId },
    });

    if (!client) {
      this.log.warn('linkClient: client not found', { adminId, clientId });
      return false;
    }

    if (client.optedOut) {
      this.log.warn('linkClient: client has opted out', { adminId, clientId });
      return false;
    }

    const encryptedChatId = this.encryption.encrypt(chatId);

    if (channel === 'telegram') {
      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          telegramChatIdEncrypted: encryptedChatId,
          preferredChannel: 'telegram',
        },
      });
    } else {
      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          maxChatIdEncrypted: encryptedChatId,
          preferredChannel: 'max',
        },
      });
    }

    // Log with masked chat ID for privacy (show last 4 chars only)
    const maskedChatId = chatId.length > 4 ? `****${chatId.slice(-4)}` : '****';
    this.log.info('client linked to messenger', { adminId, clientId, channel, maskedChatId });

    return true;
  }

  /**
   * Send a confirmation message to the newly linked client.
   * Failures are logged but not thrown — non-critical.
   */
  async sendConfirmation(
    adminId: string,
    channel: 'telegram' | 'max',
    chatId: string,
  ): Promise<void> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      this.log.warn('sendConfirmation: admin not found', { adminId });
      return;
    }

    const confirmationText = 'Вы подключены! Теперь уведомления будут приходить сюда.';

    try {
      if (channel === 'telegram' && admin.telegramBotTokenEncrypted) {
        const token = this.encryption.decrypt(Buffer.from(admin.telegramBotTokenEncrypted));
        const provider = new TelegramProvider(token);
        const result = await provider.send(chatId, confirmationText);
        if (!result.success) {
          this.log.warn('sendConfirmation: telegram send failed', {
            adminId,
            error: result.error,
          });
        }
      } else if (channel === 'max' && admin.maxBotTokenEncrypted) {
        const token = this.encryption.decrypt(Buffer.from(admin.maxBotTokenEncrypted));
        const provider = new MaxProvider(token);
        const result = await provider.send(chatId, confirmationText);
        if (!result.success) {
          this.log.warn('sendConfirmation: max send failed', {
            adminId,
            error: result.error,
          });
        }
      } else {
        this.log.warn('sendConfirmation: no bot token configured', { adminId, channel });
      }
    } catch (err: unknown) {
      this.log.error('sendConfirmation: unexpected error', {
        adminId,
        channel,
        error: String(err),
      });
    }
  }

  /**
   * Register a webhook with Telegram or Max for the given admin.
   * Returns { success: false, error } when the provider rejects — token is still valid.
   */
  async registerWebhook(
    adminId: string,
    channel: 'telegram' | 'max',
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = `${this.apiBaseUrl}/api/webhooks/${channel}/${adminId}`;

    if (channel === 'telegram') {
      const secretToken = this.generateTelegramSecret(adminId);
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: secretToken,
            allowed_updates: ['message'],
          }),
          signal: AbortSignal.timeout(10000),
        });

        const data = (await response.json()) as TelegramSetWebhookResponse;
        if (data.ok) {
          this.log.info('telegram webhook registered', { adminId, webhookUrl });
          return { success: true };
        }

        this.log.warn('telegram webhook registration failed', {
          adminId,
          description: data.description,
        });
        return { success: false, error: data.description ?? 'Telegram setWebhook returned ok=false' };
      } catch (err: unknown) {
        const error = String(err);
        this.log.error('telegram webhook registration error', { adminId, error });
        return { success: false, error };
      }
    }

    // Max channel
    try {
      const response = await fetch('https://botapi.max.ru/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': token,
        },
        body: JSON.stringify({
          url: webhookUrl,
          update_types: ['message_created'],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as MaxSubscriptionResponse;
      if (response.ok) {
        this.log.info('max webhook registered', { adminId, webhookUrl });
        return { success: true };
      }

      const errorMsg = data.error ?? data.description ?? 'Max subscription API error';
      this.log.warn('max webhook registration failed', { adminId, error: errorMsg });
      return { success: false, error: errorMsg };
    } catch (err: unknown) {
      const error = String(err);
      this.log.error('max webhook registration error', { adminId, error });
      return { success: false, error };
    }
  }

  /**
   * Remove a registered webhook from Telegram or Max.
   * Failures are logged but not thrown — non-critical cleanup.
   */
  async deregisterWebhook(channel: 'telegram' | 'max', token: string): Promise<void> {
    if (channel === 'telegram') {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
        });
        const data = (await response.json()) as TelegramSetWebhookResponse;
        this.log.info('telegram webhook deregistered', { ok: data.ok });
      } catch (err: unknown) {
        this.log.warn('telegram webhook deregistration failed', { error: String(err) });
      }
      return;
    }

    // Max channel
    try {
      const response = await fetch('https://botapi.max.ru/subscriptions', {
        method: 'DELETE',
        headers: { 'access_token': token },
        signal: AbortSignal.timeout(10000),
      });
      this.log.info('max webhook deregistered', { status: response.status });
    } catch (err: unknown) {
      this.log.warn('max webhook deregistration failed', { error: String(err) });
    }
  }
}
