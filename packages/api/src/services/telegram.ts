import type { MessageResult } from './message-gateway.js';

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: {
    message_id: number;
    from?: {
      username?: string;
    };
    username?: string;
  };
}

export class TelegramProvider {
  readonly channel = 'telegram' as const;
  private readonly baseUrl: string;

  constructor(private readonly token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async send(chatId: string, message: string): Promise<MessageResult> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as TelegramResponse;

      if (data.ok && data.result) {
        return { success: true, externalId: String(data.result.message_id) };
      }

      return { success: false, error: data.description ?? 'Unknown Telegram error' };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as TelegramResponse;
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async getBotInfo(): Promise<{ username: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as { ok: boolean; result?: { username?: string } };
      if (data.ok && data.result?.username) {
        return { username: data.result.username };
      }
      return null;
    } catch {
      return null;
    }
  }
}
