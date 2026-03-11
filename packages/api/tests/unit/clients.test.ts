import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.js';

const { ClientsService } = await import('../../src/modules/clients/service.js');

const encKey = 'a'.repeat(64);
const encryption = new EncryptionService(encKey);

function createMockPrisma() {
  return {
    client: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as any;
}

function makeEncryptedClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'client-1',
    name: 'Иван',
    phoneEncrypted: encryption.encrypt('+79001234567'),
    emailEncrypted: null,
    telegramChatIdEncrypted: null,
    maxChatIdEncrypted: null,
    preferredChannel: 'sms',
    optedOut: false,
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('ClientsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof ClientsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ClientsService(prisma, encryption);
  });

  describe('create', () => {
    it('creates client with encrypted phone', async () => {
      const encClient = makeEncryptedClient();
      prisma.client.create.mockResolvedValue(encClient);

      const result = await service.create('admin-1', {
        name: 'Иван',
        phone: '+79001234567',
      });

      expect(result.name).toBe('Иван');
      expect(result.phone).toBe('+79001234567');
      expect(result.preferred_channel).toBe('sms');
      expect(prisma.client.create).toHaveBeenCalledTimes(1);
    });

    it('encrypts optional fields when provided', async () => {
      const encClient = makeEncryptedClient({
        emailEncrypted: encryption.encrypt('test@mail.ru'),
        telegramChatIdEncrypted: encryption.encrypt('12345'),
        maxChatIdEncrypted: encryption.encrypt('67890'),
        preferredChannel: 'telegram',
      });
      prisma.client.create.mockResolvedValue(encClient);

      const result = await service.create('admin-1', {
        name: 'Иван',
        phone: '+79001234567',
        email: 'test@mail.ru',
        telegram_chat_id: '12345',
        max_chat_id: '67890',
        preferred_channel: 'telegram',
      });

      expect(result.email).toBe('test@mail.ru');
      expect(result.telegram_chat_id).toBe('12345');
      expect(result.max_chat_id).toBe('67890');
      expect(result.preferred_channel).toBe('telegram');
    });
  });

  describe('list', () => {
    it('returns paginated decrypted clients', async () => {
      const encClient = makeEncryptedClient();
      prisma.client.findMany.mockResolvedValue([encClient]);
      prisma.client.count.mockResolvedValue(1);

      const result = await service.list('admin-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].phone).toBe('+79001234567');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('applies search filter', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await service.list('admin-1', { page: 1, limit: 20, search: 'Иван' });

      const findCall = prisma.client.findMany.mock.calls[0][0];
      expect(findCall.where.name).toEqual({ contains: 'Иван', mode: 'insensitive' });
    });

    it('paginates correctly', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(50);

      await service.list('admin-1', { page: 3, limit: 10 });

      const findCall = prisma.client.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(20);
      expect(findCall.take).toBe(10);
    });
  });

  describe('delete', () => {
    it('deletes client by adminId and clientId', async () => {
      prisma.client.deleteMany.mockResolvedValue({ count: 1 });

      await service.delete('admin-1', 'client-1');

      expect(prisma.client.deleteMany).toHaveBeenCalledWith({
        where: { id: 'client-1', adminId: 'admin-1' },
      });
    });
  });

  describe('importCsv', () => {
    it('imports valid CSV rows', async () => {
      prisma.client.create.mockResolvedValue({});

      const csv = 'name,phone\nИван,+79001234567\nМария,+79009876543';
      const result = await service.importCsv('admin-1', csv);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('skips rows without name or phone', async () => {
      const csv = 'name,phone\n,+79001234567\nИван,';
      const result = await service.importCsv('admin-1', csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('validates phone format', async () => {
      const csv = 'name,phone\nИван,12345\nМария,+79001234567';
      prisma.client.create.mockResolvedValue({});

      const result = await service.importCsv('admin-1', csv);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain('invalid phone format');
    });

    it('validates telegram_chat_id is numeric', async () => {
      const csv = 'name,phone,email,telegram_chat_id\nИван,+79001234567,,abc';
      const result = await service.importCsv('admin-1', csv);

      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain('telegram_chat_id must be numeric');
    });

    it('auto-detects preferred channel from chat IDs', async () => {
      prisma.client.create.mockResolvedValue({});

      const csv = 'name,phone,email,telegram_chat_id\nИван,+79001234567,,12345';
      await service.importCsv('admin-1', csv);

      const createCall = prisma.client.create.mock.calls[0][0];
      expect(createCall.data.preferredChannel).toBe('telegram');
    });

    it('handles headerless CSV', async () => {
      prisma.client.create.mockResolvedValue({});

      const csv = 'Иван,+79001234567';
      const result = await service.importCsv('admin-1', csv);

      expect(result.imported).toBe(1);
    });
  });
});
