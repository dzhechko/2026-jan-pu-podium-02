import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.js';

const { WebhookService } = await import('../../src/modules/webhooks/service.js');

const encKey = 'a'.repeat(64);
const encryption = new EncryptionService(encKey);
const WEBHOOK_SECRET = 'a'.repeat(32);
const API_BASE_URL = 'https://api.example.com';

function createMockPrisma() {
  return {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    admin: {
      findUnique: vi.fn(),
    },
  } as any;
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('WebhookService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof WebhookService>;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    prisma = createMockPrisma();
    logger = createLogger();
    service = new WebhookService(prisma, encryption, WEBHOOK_SECRET, API_BASE_URL, logger);
  });

  describe('generateTelegramSecret', () => {
    it('returns consistent HMAC for same adminId', () => {
      const s1 = service.generateTelegramSecret('admin-1');
      const s2 = service.generateTelegramSecret('admin-1');
      expect(s1).toBe(s2);
      expect(s1).toHaveLength(64); // sha256 hex
    });

    it('returns different HMAC for different adminIds', () => {
      const s1 = service.generateTelegramSecret('admin-1');
      const s2 = service.generateTelegramSecret('admin-2');
      expect(s1).not.toBe(s2);
    });
  });

  describe('verifyTelegramSecret', () => {
    it('returns true for valid token', () => {
      const token = service.generateTelegramSecret('admin-1');
      expect(service.verifyTelegramSecret('admin-1', token)).toBe(true);
    });

    it('returns false for invalid token', () => {
      expect(service.verifyTelegramSecret('admin-1', 'wrong')).toBe(false);
    });

    it('returns false for wrong admin', () => {
      const token = service.generateTelegramSecret('admin-1');
      expect(service.verifyTelegramSecret('admin-2', token)).toBe(false);
    });
  });

  describe('generateMaxSecret', () => {
    it('returns consistent HMAC for same adminId', () => {
      const s1 = service.generateMaxSecret('admin-1');
      const s2 = service.generateMaxSecret('admin-1');
      expect(s1).toBe(s2);
      expect(s1).toHaveLength(64);
    });

    it('differs from Telegram secret for same adminId', () => {
      const tgSecret = service.generateTelegramSecret('admin-1');
      const maxSecret = service.generateMaxSecret('admin-1');
      expect(tgSecret).not.toBe(maxSecret);
    });
  });

  describe('verifyMaxSecret', () => {
    it('returns true for valid token', () => {
      const token = service.generateMaxSecret('admin-1');
      expect(service.verifyMaxSecret('admin-1', token)).toBe(true);
    });

    it('returns false for invalid token', () => {
      expect(service.verifyMaxSecret('admin-1', 'wrong')).toBe(false);
    });

    it('returns false for telegram secret used as max', () => {
      const tgToken = service.generateTelegramSecret('admin-1');
      expect(service.verifyMaxSecret('admin-1', tgToken)).toBe(false);
    });
  });

  describe('processTelegramUpdate', () => {
    const validUUID = '12345678-1234-1234-1234-123456789abc';

    it('ignores updates without message', async () => {
      await service.processTelegramUpdate('admin-1', { update_id: 1 });
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('ignores non-private chats', async () => {
      await service.processTelegramUpdate('admin-1', {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'group' },
          date: 1234567890,
        },
      });
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('ignores messages without /start', async () => {
      await service.processTelegramUpdate('admin-1', {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          text: 'hello',
          date: 1234567890,
        },
      });
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('warns on non-UUID /start param', async () => {
      await service.processTelegramUpdate('admin-1', {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          text: '/start not-a-uuid',
          date: 1234567890,
        },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'telegram webhook: /start param is not a UUID',
        expect.any(Object),
      );
    });
  });

  describe('linkClient', () => {
    const clientId = '12345678-1234-1234-1234-123456789abc';

    it('encrypts and saves telegram chat ID', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: clientId,
        adminId: 'admin-1',
        optedOut: false,
      });
      prisma.client.update.mockResolvedValue({});

      const result = await service.linkClient('admin-1', clientId, 'telegram', '123456');

      expect(result).toBe(true);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: clientId },
        data: {
          telegramChatIdEncrypted: expect.any(Buffer),
          preferredChannel: 'telegram',
        },
      });
    });

    it('encrypts and saves max chat ID', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: clientId,
        adminId: 'admin-1',
        optedOut: false,
      });
      prisma.client.update.mockResolvedValue({});

      const result = await service.linkClient('admin-1', clientId, 'max', '789');

      expect(result).toBe(true);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: clientId },
        data: {
          maxChatIdEncrypted: expect.any(Buffer),
          preferredChannel: 'max',
        },
      });
    });

    it('returns false for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const result = await service.linkClient('admin-1', clientId, 'telegram', '123');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('returns false for opted-out client', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: clientId,
        adminId: 'admin-1',
        optedOut: true,
      });

      const result = await service.linkClient('admin-1', clientId, 'telegram', '123');

      expect(result).toBe(false);
    });
  });

  describe('processMaxUpdate', () => {
    const validUUID = '12345678-1234-1234-1234-123456789abc';

    it('ignores non-bot_started events', async () => {
      await service.processMaxUpdate('admin-1', {
        update_type: 'message_created',
        timestamp: 1234567890,
      });
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('ignores bot_started without payload', async () => {
      await service.processMaxUpdate('admin-1', {
        update_type: 'bot_started',
        timestamp: 1234567890,
      });
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('warns on non-UUID payload', async () => {
      await service.processMaxUpdate('admin-1', {
        update_type: 'bot_started',
        timestamp: 1234567890,
        payload: 'not-a-uuid',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'max webhook: payload is not a UUID',
        expect.any(Object),
      );
    });

    it('warns on missing user_id', async () => {
      await service.processMaxUpdate('admin-1', {
        update_type: 'bot_started',
        timestamp: 1234567890,
        payload: validUUID,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'max webhook: bot_started without user_id',
        expect.any(Object),
      );
    });
  });
});
