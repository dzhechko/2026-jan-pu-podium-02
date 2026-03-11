export interface SmscResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmscService {
  constructor(
    private login: string,
    private password: string,
    private sender: string,
  ) {}

  async sendSms(phone: string, message: string): Promise<SmscResult> {
    if (!this.login || !this.password) {
      // Dev mode: log instead of sending
      console.log(`[SMSC DEV] To: ${phone}, Message: ${message.slice(0, 50)}...`);
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    const params = new URLSearchParams({
      login: this.login,
      psw: this.password,
      phones: phone,
      mes: message,
      sender: this.sender,
      fmt: '3', // JSON response
      charset: 'utf-8',
    });

    try {
      const response = await fetch(`https://smsc.ru/sys/send.php?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json() as Record<string, unknown>;

      if (data.error) {
        return { success: false, error: String(data.error) };
      }

      return { success: true, messageId: String(data.id ?? '') };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
