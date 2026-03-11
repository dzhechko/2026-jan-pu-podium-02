import type { MessageResult } from './telegram.js';

interface MaxSendResponse {
  message?: {
    body: {
      mid: string;
    };
  };
  error?: string;
  description?: string;
}

interface MaxMeResponse {
  user_id?: number;
  name?: string;
}

export class MaxProvider {
  readonly channel = 'max' as const;
  private readonly baseUrl = 'https://botapi.max.ru';

  constructor(private readonly token: string) {}

  async send(chatId: string, message: string): Promise<MessageResult> {
    try {
      const url = `${this.baseUrl}/messages?access_token=${encodeURIComponent(this.token)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as MaxSendResponse;

      if (data.message) {
        return { success: true, externalId: String(data.message.body.mid) };
      }

      return {
        success: false,
        error: data.error ?? data.description ?? 'Unknown Max error',
      };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/me?access_token=${encodeURIComponent(this.token)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as MaxMeResponse;
      return data.user_id != null;
    } catch {
      return false;
    }
  }

  async getBotInfo(): Promise<{ name: string } | null> {
    try {
      const url = `${this.baseUrl}/me?access_token=${encodeURIComponent(this.token)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as MaxMeResponse;
      if (data.name) {
        return { name: data.name };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export type { MessageResult };
