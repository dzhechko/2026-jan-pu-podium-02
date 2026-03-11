import type { MessageResult } from './message-gateway.js';

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

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'access_token': this.token,
    };
  }

  async send(chatId: string, message: string): Promise<MessageResult> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
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
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: { 'access_token': this.token },
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
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: { 'access_token': this.token },
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

  async subscribe(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/subscriptions?access_token=${this.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          update_types: ['message_created'],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as MaxSendResponse;

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: data.error ?? data.description ?? 'Failed to subscribe Max webhook' };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  async unsubscribe(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/subscriptions?access_token=${this.token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
