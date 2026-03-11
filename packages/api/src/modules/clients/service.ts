import type { PrismaClient } from '@prisma/client';
import type { EncryptionService } from '../../services/encryption.js';
import type { CreateClientInput, ListClientsQuery } from './schema.js';

export class ClientsService {
  constructor(
    private prisma: PrismaClient,
    private encryption: EncryptionService,
  ) {}

  async create(adminId: string, input: CreateClientInput) {
    const phoneEncrypted = this.encryption.encrypt(input.phone);
    const emailEncrypted = input.email ? this.encryption.encrypt(input.email) : null;
    const telegramChatIdEncrypted = input.telegram_chat_id
      ? this.encryption.encrypt(input.telegram_chat_id)
      : null;
    const maxChatIdEncrypted = input.max_chat_id
      ? this.encryption.encrypt(input.max_chat_id)
      : null;

    const client = await this.prisma.client.create({
      data: {
        adminId,
        name: input.name,
        phoneEncrypted,
        emailEncrypted,
        telegramChatIdEncrypted,
        maxChatIdEncrypted,
        preferredChannel: input.preferred_channel ?? 'sms',
      },
    });

    return this.decryptClient(client);
  }

  async list(adminId: string, query: ListClientsQuery) {
    const where: Record<string, unknown> = { adminId };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients.map((c) => this.decryptClient(c)),
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async delete(adminId: string, clientId: string) {
    await this.prisma.client.deleteMany({
      where: { id: clientId, adminId },
    });
  }

  async importCsv(adminId: string, csvContent: string) {
    const lines = csvContent.trim().split('\n');
    const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const validChannels = ['sms', 'telegram', 'max'];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.trim());
      const [name, phone, email, telegramChatId, maxChatId, preferredChannelRaw] = parts;

      if (!name || !phone) {
        errors.push(`Row ${i + 1}: missing name or phone`);
        skipped++;
        continue;
      }

      if (!/^\+7\d{10}$/.test(phone)) {
        errors.push(`Row ${i + 1}: invalid phone format`);
        skipped++;
        continue;
      }

      const tgChatId = telegramChatId || null;
      if (tgChatId && !/^\d+$/.test(tgChatId)) {
        errors.push(`Row ${i + 1}: telegram_chat_id must be numeric`);
        skipped++;
        continue;
      }

      const mxChatId = maxChatId || null;

      let preferredChannel = preferredChannelRaw?.trim() ?? '';
      if (!preferredChannel || !validChannels.includes(preferredChannel)) {
        if (tgChatId) {
          preferredChannel = 'telegram';
        } else if (mxChatId) {
          preferredChannel = 'max';
        } else {
          preferredChannel = 'sms';
        }
      }

      try {
        const phoneEncrypted = this.encryption.encrypt(phone);
        const emailEncrypted = email ? this.encryption.encrypt(email) : null;
        const telegramChatIdEncrypted = tgChatId ? this.encryption.encrypt(tgChatId) : null;
        const maxChatIdEncrypted = mxChatId ? this.encryption.encrypt(mxChatId) : null;

        await this.prisma.client.create({
          data: {
            adminId,
            name,
            phoneEncrypted,
            emailEncrypted,
            telegramChatIdEncrypted,
            maxChatIdEncrypted,
            preferredChannel,
          },
        });
        imported++;
      } catch {
        skipped++;
        errors.push(`Row ${i + 1}: duplicate or error`);
      }
    }

    return { imported, skipped, errors };
  }

  private decryptClient(client: {
    id: string;
    name: string;
    phoneEncrypted: Buffer;
    emailEncrypted: Buffer | null;
    telegramChatIdEncrypted: Buffer | null;
    maxChatIdEncrypted: Buffer | null;
    preferredChannel: string;
    optedOut: boolean;
    createdAt: Date;
  }) {
    return {
      id: client.id,
      name: client.name,
      phone: this.encryption.decrypt(Buffer.from(client.phoneEncrypted)),
      email: client.emailEncrypted
        ? this.encryption.decrypt(Buffer.from(client.emailEncrypted))
        : null,
      telegram_chat_id: client.telegramChatIdEncrypted
        ? this.encryption.decrypt(Buffer.from(client.telegramChatIdEncrypted))
        : null,
      max_chat_id: client.maxChatIdEncrypted
        ? this.encryption.decrypt(Buffer.from(client.maxChatIdEncrypted))
        : null,
      preferred_channel: client.preferredChannel,
      opted_out: client.optedOut,
      created_at: client.createdAt.toISOString(),
    };
  }
}
