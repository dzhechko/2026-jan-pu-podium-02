import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.js';

const { MessageGateway } = await import('../../src/services/message-gateway.js');

const encKey = 'a'.repeat(64);
const encryption = new EncryptionService(encKey);

function createMockSmsc() {
  return {
    sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'sms-1' }),
  } as any;
}

function createMockPrisma(adminOverrides: Record<string, unknown> = {}) {
  return {
    admin: {
      findUnique: vi.fn().mockResolvedValue({
        telegramBotTokenEncrypted: null,
        maxBotTokenEncrypted: null,
        ...adminOverrides,
      }),
    },
  } as any;
}

describe('MessageGateway', () => {
  describe('send via SMS (default)', () => {
    it('sends SMS when channel is sms', async () => {
      const smsc = createMockSmsc();
      const prisma = createMockPrisma();
      const gw = new MessageGateway(smsc, prisma, encryption);

      const result = await gw.send(
        'admin-1',
        'sms',
        { phone: '+79001234567' },
        async () => 'Hello!',
      );

      expect(result.success).toBe(true);
      expect(result.actualChannel).toBe('sms');
      expect(smsc.sendSms).toHaveBeenCalledWith('+79001234567', 'Hello!');
    });
  });

  describe('fallback to SMS', () => {
    it('falls back to SMS when telegram is not configured', async () => {
      const smsc = createMockSmsc();
      const prisma = createMockPrisma();
      const gw = new MessageGateway(smsc, prisma, encryption);
      const messageFetcher = vi.fn()
        .mockResolvedValueOnce('telegram msg')
        .mockResolvedValueOnce('sms msg');

      const result = await gw.send(
        'admin-1',
        'telegram',
        { phone: '+79001234567', telegramChatId: '12345' },
        messageFetcher,
      );

      expect(result.success).toBe(true);
      expect(result.actualChannel).toBe('sms');
      expect(result.fallbackFrom).toBe('telegram');
    });

    it('returns failure when no channel available and channel is sms', async () => {
      const smsc = createMockSmsc();
      smsc.sendSms.mockResolvedValue({ success: false, error: 'fail' });
      const prisma = createMockPrisma();
      const gw = new MessageGateway(smsc, prisma, encryption);

      const result = await gw.send(
        'admin-1',
        'sms',
        { phone: '+79001234567' },
        async () => 'msg',
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getConfiguredChannelsForAdmin', () => {
    it('returns only sms when no tokens configured', async () => {
      const smsc = createMockSmsc();
      const prisma = createMockPrisma();
      const gw = new MessageGateway(smsc, prisma, encryption);

      const channels = await gw.getConfiguredChannelsForAdmin('admin-1');

      expect(channels).toContain('sms');
      expect(channels).not.toContain('telegram');
      expect(channels).not.toContain('max');
    });

    it('returns all channels when tokens are configured', async () => {
      const smsc = createMockSmsc();
      const prisma = createMockPrisma({
        telegramBotTokenEncrypted: encryption.encrypt('tg-token'),
        maxBotTokenEncrypted: encryption.encrypt('max-token'),
      });
      const gw = new MessageGateway(smsc, prisma, encryption);

      const channels = await gw.getConfiguredChannelsForAdmin('admin-1');

      expect(channels).toContain('sms');
      expect(channels).toContain('telegram');
      expect(channels).toContain('max');
    });
  });
});
