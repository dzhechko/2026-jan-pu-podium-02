import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ReminderService } = await import('../../src/services/reminder.js');

function createMockPrisma() {
  return {
    reviewRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    smsTemplate: {
      findFirst: vi.fn(),
    },
    smsLog: {
      create: vi.fn(),
    },
  } as any;
}

function createMockSmsc() {
  return {
    sendSms: vi.fn(),
  } as any;
}

function createMockEncryption() {
  return {
    decrypt: vi.fn().mockReturnValue('+79001234567'),
  } as any;
}

describe('ReminderService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let smsc: ReturnType<typeof createMockSmsc>;
  let encryption: ReturnType<typeof createMockEncryption>;
  let service: InstanceType<typeof ReminderService>;

  const baseRequest = {
    id: 'req-1',
    adminId: 'admin-1',
    clientId: 'client-1',
    token: 'abc123',
    status: 'SMS_SENT',
    reminderCount: 0,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    nextReminderAt: new Date(Date.now() - 1000),
    client: {
      id: 'client-1',
      phoneEncrypted: Buffer.from('encrypted'),
      optedOut: false,
    },
    admin: {
      id: 'admin-1',
      companyName: 'TestCompany',
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    smsc = createMockSmsc();
    encryption = createMockEncryption();
    service = new ReminderService(prisma, smsc, encryption, 'https://pwa.test');
    prisma.reviewRequest.update.mockResolvedValue({});
    prisma.smsLog.create.mockResolvedValue({});
    prisma.smsTemplate.findFirst.mockResolvedValue(null);
  });

  it('sends reminder and increments count', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-1' });

    const result = await service.processReminders();

    expect(result.sent).toBe(1);
    expect(smsc.sendSms).toHaveBeenCalledWith('+79001234567', expect.stringContaining('TestCompany'));
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
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-1' });

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
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-4' });

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
    expect(smsc.sendSms).not.toHaveBeenCalled();
    expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'OPTED_OUT', nextReminderAt: null },
    });
  });

  it('does not advance reminder on SMS failure', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);
    smsc.sendSms.mockResolvedValue({ success: false, error: 'Network error' });

    const result = await service.processReminders();

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    // Should NOT update the review request (no advancement)
    expect(prisma.reviewRequest.update).not.toHaveBeenCalled();
  });

  it('includes opt-out link in SMS', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-1' });

    await service.processReminders();

    const smsMessage = smsc.sendSms.mock.calls[0][1];
    expect(smsMessage).toContain('Отписка:');
    expect(smsMessage).toContain('optout');
  });

  it('uses custom template when available', async () => {
    prisma.reviewRequest.findMany.mockResolvedValue([baseRequest]);
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-1' });
    prisma.smsTemplate.findFirst.mockResolvedValue({
      messageTemplate: '{company} — отзыв: {link} Стоп: {optout}',
    });

    await service.processReminders();

    const smsMessage = smsc.sendSms.mock.calls[0][1];
    expect(smsMessage).toContain('TestCompany — отзыв:');
    expect(smsMessage).toContain('Стоп:');
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
    smsc.sendSms.mockResolvedValue({ success: true, messageId: 'sms-3' });

    await service.processReminders();

    expect(prisma.smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reminderNumber: 3,
        smscMessageId: 'sms-3',
      }),
    });
  });
});
