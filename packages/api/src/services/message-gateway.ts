import type { SmscService } from './smsc.js';
import { TelegramProvider } from './telegram.js';
import { MaxProvider } from './max.js';
import type { EncryptionService } from './encryption.js';
import type { PrismaClient } from '@prisma/client';

export interface MessageResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface MessageSendResult extends MessageResult {
  actualChannel: string;
  fallbackFrom?: string;
}

export interface Recipient {
  phone: string;
  telegramChatId?: string;
  maxChatId?: string;
}

export type MessageFetcher = (channel: string) => Promise<string>;

interface MessageProvider {
  readonly channel: string;
  send(recipientId: string, message: string): Promise<MessageResult>;
}

/** Adapter to make SmscService conform to the MessageProvider interface. */
class SmscAdapter implements MessageProvider {
  readonly channel = 'sms' as const;

  constructor(private readonly smsc: SmscService) {}

  async send(phone: string, message: string): Promise<MessageResult> {
    const result = await this.smsc.sendSms(phone, message);
    return {
      success: result.success,
      externalId: result.messageId,
      error: result.error,
    };
  }
}

export interface GatewayLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * MessageGateway creates per-admin Telegram/Max providers on-the-fly
 * by decrypting bot tokens from the admin record.
 * SMS provider is shared (credentials from env).
 */
export class MessageGateway {
  private readonly smsProvider: SmscAdapter;

  constructor(
    smscService: SmscService,
    private readonly prisma: PrismaClient,
    private readonly encryption: EncryptionService,
    private readonly logger?: GatewayLogger,
  ) {
    this.smsProvider = new SmscAdapter(smscService);
  }

  /**
   * Build per-admin providers by decrypting stored bot tokens.
   */
  private async getProvidersForAdmin(adminId: string): Promise<Map<string, MessageProvider>> {
    const providers = new Map<string, MessageProvider>();
    providers.set('sms', this.smsProvider);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { telegramBotTokenEncrypted: true, maxBotTokenEncrypted: true },
    });

    if (admin?.telegramBotTokenEncrypted) {
      const token = this.encryption.decrypt(Buffer.from(admin.telegramBotTokenEncrypted));
      providers.set('telegram', new TelegramProvider(token));
    }

    if (admin?.maxBotTokenEncrypted) {
      const token = this.encryption.decrypt(Buffer.from(admin.maxBotTokenEncrypted));
      providers.set('max', new MaxProvider(token));
    }

    return providers;
  }

  async send(
    adminId: string,
    channel: string,
    recipient: Recipient,
    messageFetcher: MessageFetcher,
  ): Promise<MessageSendResult> {
    const providers = await this.getProvidersForAdmin(adminId);
    const recipientId = this.getRecipientId(channel, recipient);
    const provider = providers.get(channel);

    // Try primary channel
    if (provider && recipientId) {
      const message = await messageFetcher(channel);
      const result = await provider.send(recipientId, message);
      if (result.success) {
        return { ...result, actualChannel: channel };
      }
      this.logger?.warn(`Channel ${channel} failed for admin ${adminId}: ${result.error ?? 'unknown'}`);
    } else if (!provider) {
      this.logger?.warn(`Channel ${channel} not configured for admin ${adminId}`);
    }

    // Fallback to SMS if messenger fails or is not available
    if (channel !== 'sms' && recipient.phone) {
      const smsMessage = await messageFetcher('sms');
      const smsResult = await this.smsProvider.send(recipient.phone, smsMessage);
      return { ...smsResult, actualChannel: 'sms', fallbackFrom: channel };
    }

    return { success: false, error: 'No channel available', actualChannel: channel };
  }

  async getConfiguredChannelsForAdmin(adminId: string): Promise<string[]> {
    const providers = await this.getProvidersForAdmin(adminId);
    return Array.from(providers.keys());
  }

  private getRecipientId(channel: string, recipient: Recipient): string | undefined {
    switch (channel) {
      case 'sms':
        return recipient.phone;
      case 'telegram':
        return recipient.telegramChatId;
      case 'max':
        return recipient.maxChatId;
      default:
        return undefined;
    }
  }
}
