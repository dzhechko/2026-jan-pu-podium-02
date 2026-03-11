import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import type { SmscService } from './smsc.js';
import type { EncryptionService } from './encryption.js';

const TERMINAL_STATUSES = ['REVIEWED', 'OPTED_OUT', 'EXPIRED'];
const MAX_REMINDERS = 4;
const BATCH_SIZE = 50;

// Delays between reminders (from current reminder to next)
const REMINDER_DELAYS: Record<number, number> = {
  2: 22 * 60 * 60 * 1000,     // After reminder 1: +22h (total 24h from initial)
  3: 2 * 24 * 60 * 60 * 1000, // After reminder 2: +2d (total 3d)
  4: 4 * 24 * 60 * 60 * 1000, // After reminder 3: +4d (total 7d)
};

interface ReminderResult {
  sent: number;
  failed: number;
  expired: number;
}

export class ReminderService {
  private task: cron.ScheduledTask | null = null;

  constructor(
    private prisma: PrismaClient,
    private smsc: SmscService,
    private encryption: EncryptionService,
    private pwaUrl: string,
    private logger?: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void },
  ) {}

  async processReminders(): Promise<ReminderResult> {
    const result: ReminderResult = { sent: 0, failed: 0, expired: 0 };
    const now = new Date();

    const requests = await this.prisma.reviewRequest.findMany({
      where: {
        nextReminderAt: { lte: now },
        status: { notIn: TERMINAL_STATUSES },
        reminderCount: { lt: MAX_REMINDERS },
      },
      include: {
        client: true,
        admin: true,
      },
      take: BATCH_SIZE,
      orderBy: { nextReminderAt: 'asc' },
    });

    for (const request of requests) {
      try {
        // Check expiration
        if (request.expiresAt < now) {
          await this.prisma.reviewRequest.update({
            where: { id: request.id },
            data: { status: 'EXPIRED', nextReminderAt: null },
          });
          result.expired++;
          continue;
        }

        // Check opt-out
        if (request.client.optedOut) {
          await this.prisma.reviewRequest.update({
            where: { id: request.id },
            data: { status: 'OPTED_OUT', nextReminderAt: null },
          });
          continue;
        }

        const nextReminderNumber = request.reminderCount + 1;

        // Decrypt phone
        const phone = this.encryption.decrypt(Buffer.from(request.client.phoneEncrypted));
        const phoneMasked = phone.slice(0, 4) + '****' + phone.slice(-2);

        // Build message
        const link = `${this.pwaUrl}/review/${request.token}`;
        const optoutLink = `${this.pwaUrl}/optout/${request.token}`;
        const message = await this.buildMessage(
          request.adminId,
          nextReminderNumber,
          request.admin.companyName,
          link,
          optoutLink,
        );

        // Send SMS
        const smsResult = await this.smsc.sendSms(phone, message);

        if (smsResult.success) {
          // Calculate next reminder timing
          const nextDelay = REMINDER_DELAYS[nextReminderNumber + 1];
          const nextReminderAt = nextDelay ? new Date(now.getTime() + nextDelay) : null;

          await this.prisma.reviewRequest.update({
            where: { id: request.id },
            data: {
              reminderCount: nextReminderNumber,
              nextReminderAt,
              status: `REMINDED_${nextReminderNumber}`,
            },
          });

          await this.prisma.smsLog.create({
            data: {
              reviewRequestId: request.id,
              phoneMasked,
              messagePreview: message.slice(0, 100),
              smscMessageId: smsResult.messageId,
              status: 'SENT',
              reminderNumber: nextReminderNumber,
              sentAt: now,
            },
          });

          result.sent++;
        } else {
          // Don't advance reminder count on failure — retry next cron tick
          this.logger?.error(`SMS failed for request ${request.id}: ${smsResult.error}`);
          result.failed++;
        }
      } catch (err) {
        this.logger?.error(`Reminder processing error for ${request.id}`, err);
        result.failed++;
      }
    }

    return result;
  }

  private async buildMessage(
    adminId: string,
    reminderNumber: number,
    companyName: string,
    link: string,
    optoutLink: string,
  ): Promise<string> {
    // Try to use custom template
    const template = await this.prisma.smsTemplate.findFirst({
      where: { adminId, reminderNumber },
    });

    if (template) {
      return template.messageTemplate
        .replace('{company}', companyName)
        .replace('{link}', link)
        .replace('{optout}', optoutLink);
    }

    // Default message
    return `${companyName}: Напоминаем — оставьте отзыв: ${link}\nОтписка: ${optoutLink}`;
  }

  startScheduler(): void {
    this.task = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await this.processReminders();
        if (result.sent > 0 || result.failed > 0 || result.expired > 0) {
          this.logger?.info(
            `Reminders processed: sent=${result.sent}, failed=${result.failed}, expired=${result.expired}`,
          );
        }
      } catch (err) {
        this.logger?.error('Reminder scheduler error', err);
      }
    });

    this.logger?.info('Reminder scheduler started (every 5 minutes)');
  }

  stopScheduler(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}
