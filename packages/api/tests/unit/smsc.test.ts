import { describe, it, expect, vi, afterEach } from 'vitest';

const { SmscService } = await import('../../src/services/smsc.js');

describe('SmscService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('dev mode (no credentials)', () => {
    it('returns success with dev messageId when no login/password', async () => {
      const service = new SmscService('', '');

      const result = await service.sendSms('+79001234567', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
    });
  });

  describe('production mode', () => {
    it('sends SMS via SMSC API', async () => {
      const service = new SmscService('login', 'password');
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 12345, cnt: 1 }),
      }) as any;

      const result = await service.sendSms('+79001234567', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('12345');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns error on API failure', async () => {
      const service = new SmscService('login', 'password');
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'insufficient funds', error_code: 2 }),
      }) as any;

      const result = await service.sendSms('+79001234567', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient funds');
    });

    it('handles network errors', async () => {
      const service = new SmscService('login', 'password');
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

      const result = await service.sendSms('+79001234567', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
