import { describe, it, expect, vi, beforeEach } from 'vitest';

const { SmsTemplateService } = await import('../../src/modules/sms/template-service.js');

function createMockPrisma() {
  return {
    smsTemplate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as any;
}

describe('SmsTemplateService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof SmsTemplateService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SmsTemplateService(prisma);
  });

  describe('upsertTemplate', () => {
    it('creates new template when none exists', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue(null);
      prisma.smsTemplate.create.mockResolvedValue({ id: 't-1', reminderNumber: 1, messageTemplate: 'test {link} {optout}' });

      const result = await service.upsertTemplate('admin-1', 1, 'test {link} {optout}');

      expect(prisma.smsTemplate.create).toHaveBeenCalledWith({
        data: { adminId: 'admin-1', reminderNumber: 1, messageTemplate: 'test {link} {optout}' },
      });
      expect(result.id).toBe('t-1');
    });

    it('updates existing template', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue({ id: 't-1' });
      prisma.smsTemplate.update.mockResolvedValue({ id: 't-1', messageTemplate: 'updated {link} {optout}' });

      await service.upsertTemplate('admin-1', 1, 'updated {link} {optout}');

      expect(prisma.smsTemplate.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { messageTemplate: 'updated {link} {optout}' },
      });
    });

    it('rejects template without {link}', async () => {
      await expect(
        service.upsertTemplate('admin-1', 0, 'Привет! {optout}')
      ).rejects.toThrow('{link}');
    });

    it('rejects template without {optout}', async () => {
      await expect(
        service.upsertTemplate('admin-1', 0, 'Привет! {link}')
      ).rejects.toThrow('{optout}');
    });
  });

  describe('getMessage', () => {
    it('uses custom template when exists', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue({
        messageTemplate: '{company}: Нажмите {link} Стоп: {optout}',
      });

      const msg = await service.getMessage('admin-1', 0, 'Кофе', 'https://l.ink', 'https://opt.out');

      expect(msg).toBe('Кофе: Нажмите https://l.ink Стоп: https://opt.out');
    });

    it('uses default template when none exists', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue(null);

      const msg = await service.getMessage('admin-1', 0, 'Кофе', 'https://l.ink', 'https://opt.out');

      expect(msg).toContain('Кофе');
      expect(msg).toContain('https://l.ink');
      expect(msg).toContain('https://opt.out');
    });

    it('uses default for reminder 4 (last)', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue(null);

      const msg = await service.getMessage('admin-1', 4, 'Кофе', 'https://l.ink', 'https://opt.out');

      expect(msg).toContain('Последнее напоминание');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes owned template', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue({ id: 't-1', adminId: 'admin-1' });
      prisma.smsTemplate.delete.mockResolvedValue({});

      await service.deleteTemplate('admin-1', 't-1');

      expect(prisma.smsTemplate.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
    });

    it('throws when template not found', async () => {
      prisma.smsTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('admin-1', 't-999')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('listTemplates', () => {
    it('returns templates with defaults', async () => {
      prisma.smsTemplate.findMany.mockResolvedValue([
        { id: 't-1', reminderNumber: 0, messageTemplate: 'custom', createdAt: new Date() },
      ]);

      const result = await service.listTemplates('admin-1');

      expect(result.data).toHaveLength(1);
      expect(result.defaults).toHaveProperty('0');
      expect(result.defaults).toHaveProperty('4');
    });
  });
});
