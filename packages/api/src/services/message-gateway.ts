import type { SmscService } from './smsc.js';
import type { TelegramProvider } from './telegram.js';
import type { MaxProvider } from './max.js';

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

export class MessageGateway {
  private readonly providers = new Map<string, MessageProvider>();

  constructor(
    smscService: SmscService,
    telegramProvider?: TelegramProvider,
    maxProvider?: MaxProvider,
  ) {
    this.providers.set('sms', new SmscAdapter(smscService));
    if (telegramProvider) {
      this.providers.set('telegram', telegramProvider);
    }
    if (maxProvider) {
      this.providers.set('max', maxProvider);
    }
  }

  async send(
    channel: string,
    recipient: Recipient,
    messageFetcher: MessageFetcher,
  ): Promise<MessageSendResult> {
    const recipientId = this.getRecipientId(channel, recipient);
    const provider = this.providers.get(channel);

    // Try primary channel
    if (provider && recipientId) {
      const message = await messageFetcher(channel);
      const result = await provider.send(recipientId, message);
      if (result.success) {
        return { ...result, actualChannel: channel };
      }
      console.warn(`Channel ${channel} failed: ${result.error ?? 'unknown'}`);
    }

    // Fallback to SMS if messenger fails or is not available
    if (channel !== 'sms') {
      const smsProvider = this.providers.get('sms');
      if (smsProvider && recipient.phone) {
        const smsMessage = await messageFetcher('sms');
        const smsResult = await smsProvider.send(recipient.phone, smsMessage);
        return { ...smsResult, actualChannel: 'sms', fallbackFrom: channel };
      }
    }

    return { success: false, error: 'No channel available', actualChannel: channel };
  }

  getConfiguredChannels(): string[] {
    return Array.from(this.providers.keys());
  }

  hasChannel(channel: string): boolean {
    return this.providers.has(channel);
  }

  private getRecipientId(channel: string, recipient: Recipient): string | undefined {
    switch (channel) {
      case 'sms':
        return recipient.phone;
      case 'telegram':
        return recipient.telegramChatId ?? undefined;
      case 'max':
        return recipient.maxChatId ?? undefined;
      default:
        return undefined;
    }
  }
}
