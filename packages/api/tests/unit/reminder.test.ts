import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ReminderService } = await import('../../src/services/reminder.js');

function createMockPrisma() {
  return {
    reviewRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    smsLog: {
      create: vi.fn(),
    },
  } as any;
}

function createMockGateway() {
  return {
    send: vi.fn().mockResolvedValue({
      success: true,
      externalId: 'ext-1',
      actualChannel: 'sms',
    }),
  } as any;
}

function createMockEncryption() {
  return {
    decrypt: vi.fn().mockReturnValue('+79001234567'),
  } as any;
}

function createMockTemplateService() {
  return {
    getMessage: vi.fn().mockResolvedValue('Template message'),
  } as any;
}

describe('ReminderService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let gateway: ReturnType<typeof createMockGateway>;
  let encryption: ReturnType<typeof createMockEncryption>;
  let service: InstanceType<typeof ReminderService>;

  const baseRequest = {
    id: 'req-1',
    adminId: 'admin-1',
    clientId: 'client-1',
    token: 'abc123',
    channel: 'sms',
    status: 'SMS_SENT',
    reminderCount: 0,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    nextReminderAt: new Date(Date.now() - 1000),
    client: {
      id: 'client-1',
      phoneEncrypted: Buffer.from('encrypted'),
      telegramChatIdEncrypted: null,
      maxChatIdEncrypted: null,
      optedOut: false,
    },
    admin: {
      id: 'admin-1',
      companyName: 'TestCompany',
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    gateway = createMockGateway();
    encryption = createMockEncryption();
    service = new ReminderService(prisma, gateway, encryption, 'https://pwa.test');
    prisma.reviewRequest.update.mockResolvedValue({});
    prisma.smsLog.create.mockResolvedValue({});
  });

  it('sends reminder and increments count', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);

    const result = await service.processReminders();

    expect(result.sent).toBe(1);
    expect(gateway.send).toHaveBeenCalledWith(
      'admin-1',
      'sms',
      expect.objectContaining({ phone: '+79001234567' }),
      expect.any(Function),
    );
    expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        reminderCount: 1,
        status: 'REMINDED_1',
      }),
    });
  });

  it('schedules next reminder after reminder 1', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);

    await service.processReminders();

    const updateCall = prisma.reviewRequest.update.mock.calls[0][0];
    expect(updateCall.data.nextReminderAt).not.toBeNull();
  });

  it('sets nextReminderAt to null after reminder 4 (max)', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([{
      ...baseRequest,
      reminderCount: 3,
      status: 'REMINDED_3',
    }]);

    await service.processReminders();

    const updateCall = prisma.reviewRequest.update.mock.calls[0][0];
    expect(updateCall.data.nextReminderAt).toBeNull();
    expect(updateCall.data.status).toBe('REMINDED_4');
  });

  it('marks expired requests', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([{
      ...baseRequest,
      expiresAt: new Date(Date.now() - 1000),
    }]);

    const result = await service.processReminders();

    expect(result.expired).toBe(1);
    expect(result.sent).toBe(0);
    expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'EXPIRED', nextReminderAt: null },
    });
  });

  it('skips opted-out clients', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([{
      ...baseRequest,
      client: { ...baseRequest.client, optedOut: true },
    }]);

    const result = await service.processReminders();

    expect(result.sent).toBe(0);
    expect(gateway.send).not.toHaveBeenCalled();
    expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'OPTED_OUT', nextReminderAt: null },
    });
  });

  it('does not advance reminder on send failure', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);
    gateway.send.mockResolvedValue({
      success: false,
      error: 'Network error',
      actualChannel: 'sms',
    });

    const result = await service.processReminders();

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('builds fallback message with opt-out link', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);

    await service.processReminders();

    // Call the messageFetcher that was passed to gateway.send
    const messageFetcher = gateway.send.mock.calls[0][3];
    const message = await messageFetcher('sms');
    expect(message).toContain('TestCompany');
    expect(message).toContain('Отписка:');
    expect(message).toContain('optout');
  });

  it('uses custom template when available', async () => {
    const templateService = createMockTemplateService();
    templateService.getMessage.mockResolvedValue('TestCompany — отзыв: link Стоп: optout');
    service = new ReminderService(prisma, gateway, encryption, 'https://pwa.test', templateService);
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);

    await service.processReminders();

    const messageFetcher = gateway.send.mock.calls[0][3];
    const message = await messageFetcher('sms');
    expect(message).toContain('TestCompany — отзыв:');
    expect(message).toContain('Стоп:');
  });

  it('handles empty batch', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([]);

    const result = await service.processReminders();

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.expired).toBe(0);
  });

  it('logs SMS with correct reminder number', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([{
      ...baseRequest,
      reminderCount: 2,
    }]);

    await service.processReminders();

    expect(prisma.smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reminderNumber: 3,
      }),
    });
  });
});
