import { createHmac, timingSafeEqual } from 'node:crypto';
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
   * Compare provided token with expected HMAC using constant-time comparison
   * to prevent timing side-channel attacks.
   */
  verifyTelegramSecret(adminId: string, providedToken: string): boolean {
    const expected = this.generateTelegramSecret(adminId);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(providedToken, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
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
   * Max uses `bot_started` event with `payload` field for deep links
   * (https://max.ru/{botName}?start={payload}), NOT /start in message text.
   */
  async processMaxUpdate(adminId: string, update: MaxWebhookBody): Promise<void> {
    if (update.update_type !== 'bot_started') return;

    // bot_started event has payload, user, and chat_id at top level
    const payload = update.payload;
    if (!payload) return;

    const clientId = payload.trim();
    if (!UUID_REGEX.test(clientId)) {
      this.log.warn('max webhook: payload is not a UUID', { adminId });
      return;
    }

    const userId = update.user?.user_id;
    if (!userId) {
      this.log.warn('max webhook: bot_started without user_id', { adminId });
      return;
    }

    const chatId = String(userId);

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

    this.log.info('client linked to messenger', { adminId, channel });

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
   * Delegates to provider methods to avoid HTTP logic duplication.
   */
  async registerWebhook(
    adminId: string,
    channel: 'telegram' | 'max',
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = `${this.apiBaseUrl}/api/webhooks/${channel}/${adminId}`;

    try {
      if (channel === 'telegram') {
        const secretToken = this.generateTelegramSecret(adminId);
        const provider = new TelegramProvider(token);
        const result = await provider.setWebhook(webhookUrl, secretToken);
        if (result.success) {
          this.log.info('telegram webhook registered', { adminId, webhookUrl });
        } else {
          this.log.warn('telegram webhook registration failed', { adminId, error: result.error });
        }
        return result;
      }

      const provider = new MaxProvider(token);
      const result = await provider.subscribe(webhookUrl);
      if (result.success) {
        this.log.info('max webhook registered', { adminId, webhookUrl });
      } else {
        this.log.warn('max webhook registration failed', { adminId, error: result.error });
      }
      return result;
    } catch (err: unknown) {
      const error = String(err);
      this.log.error('webhook registration error', { adminId, channel, error });
      return { success: false, error };
    }
  }

  /**
   * Remove a registered webhook from Telegram or Max.
   * Delegates to provider methods. Failures logged but not thrown.
   */
  async deregisterWebhook(adminId: string, channel: 'telegram' | 'max', token: string): Promise<void> {
    const webhookUrl = `${this.apiBaseUrl}/api/webhooks/${channel}/${adminId}`;

    try {
      if (channel === 'telegram') {
        const provider = new TelegramProvider(token);
        await provider.deleteWebhook();
        this.log.info('telegram webhook deregistered', { adminId });
      } else {
        const provider = new MaxProvider(token);
        await provider.unsubscribe(webhookUrl);
        this.log.info('max webhook deregistered', { adminId });
      }
    } catch (err: unknown) {
      this.log.warn('webhook deregistration failed', { channel, error: String(err) });
    }
  }
}
