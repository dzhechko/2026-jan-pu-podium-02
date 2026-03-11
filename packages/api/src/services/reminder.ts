import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import type { MessageGateway, Recipient, MessageSendResult } from './message-gateway.js';
import type { EncryptionService } from './encryption.js';
import type { SmsTemplateService } from '../modules/sms/template-service.js';

const TERMINAL_STATUSES = ['REVIEWED', 'OPTED_OUT', 'EXPIRED'];
const MAX_REMINDERS = 4;
const BATCH_SIZE = 50;

// Delay until next reminder (computed to match absolute timing from initial SMS)
// Schedule: initial → 2h → 24h → 3d → 7d (absolute from initial)
// Delays between consecutive reminders:
const NEXT_REMINDER_DELAY: Record<number, number> = {
  2: 22 * 60 * 60 * 1000,     // After #1 (at T+2h): next at T+24h → delay = 22h
  3: 2 * 24 * 60 * 60 * 1000, // After #2 (at T+24h): next at T+3d → delay = 2d
  4: 4 * 24 * 60 * 60 * 1000, // After #3 (at T+3d): next at T+7d → delay = 4d
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
    private gateway: MessageGateway,
    private encryption: EncryptionService,
    private pwaUrl: string,
    private templateService?: SmsTemplateService,
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

        // Use same channel as initial send
        const channel = request.channel ?? 'sms';

        // Decrypt phone
        const phone = this.encryption.decrypt(Buffer.from(request.client.phoneEncrypted));

        // Build message
        const link = `${this.pwaUrl}/review/${request.token}`;
        const optoutLink = `${this.pwaUrl}/optout/${request.token}`;

        // Build recipient object
        const recipient: Recipient = {
          phone,
          telegramChatId: request.client.telegramChatId ?? undefined,
          maxChatId: request.client.maxChatId ?? undefined,
        };

        // Build message fetcher (re-fetches per channel for fallback - AC-9)
        const messageFetcher = async (ch: string): Promise<string> => {
          if (this.templateService) {
            return this.templateService.getMessage(
              request.adminId,
              nextReminderNumber,
              request.admin.companyName,
              link,
              optoutLink,
              ch,
            );
          }
          return this.buildFallbackMessage(request.admin.companyName, link, optoutLink);
        };

        // Send via gateway (handles fallback + template re-fetch)
        const gatewayResult = await this.gateway.send(channel, recipient, messageFetcher);

        if (gatewayResult.success) {
          // Calculate next reminder timing
          const nextDelay = NEXT_REMINDER_DELAY[nextReminderNumber + 1];
          const nextReminderAt = nextDelay ? new Date(now.getTime() + nextDelay) : null;

          await this.prisma.reviewRequest.update({
            where: { id: request.id },
            data: {
              reminderCount: nextReminderNumber,
              nextReminderAt,
              status: `REMINDED_${nextReminderNumber}`,
              channel: gatewayResult.actualChannel,
            },
          });

          await this.createMessageLog(request.id, gatewayResult, channel, recipient, nextReminderNumber, now);
          result.sent++;
        } else {
          // Don't advance reminder count on failure — retry next cron tick
          this.logger?.error(`Message failed for request ${request.id}: ${gatewayResult.error}`);
          await this.createMessageLog(request.id, gatewayResult, channel, recipient, nextReminderNumber, null);
          result.failed++;
        }
      } catch (err) {
        this.logger?.error(`Reminder processing error for ${request.id}`, err);
        result.failed++;
      }
    }

    return result;
  }

  private buildFallbackMessage(companyName: string, link: string, optoutLink: string): string {
    return `${companyName}: Напоминаем — оставьте отзыв: ${link}\nОтписка: ${optoutLink}`;
  }

  private async createMessageLog(
    reviewRequestId: string,
    result: MessageSendResult,
    requestedChannel: string,
    recipient: Recipient,
    reminderNumber: number,
    sentAt: Date | null,
  ): Promise<void> {
    const actualChannel = result.actualChannel;
    const phoneMasked = actualChannel === 'sms'
      ? recipient.phone.slice(0, 4) + '****' + recipient.phone.slice(-2)
      : `${actualChannel}:${this.getRecipientIdForLog(actualChannel, recipient)}`;

    await this.prisma.smsLog.create({
      data: {
        reviewRequestId,
        phoneMasked,
        messagePreview: '',
        smscMessageId: actualChannel === 'sms' ? result.externalId : null,
        externalId: result.externalId,
        channel: actualChannel,
        status: result.success ? 'SENT' : 'FAILED',
        reminderNumber,
        sentAt,
      },
    });

    // Log fallback attempt separately
    if (result.fallbackFrom) {
      await this.prisma.smsLog.create({
        data: {
          reviewRequestId,
          phoneMasked: `${result.fallbackFrom}:failed`,
          messagePreview: `Fallback from ${result.fallbackFrom} to sms`,
          channel: result.fallbackFrom,
          status: 'FAILED',
          reminderNumber,
        },
      });
    }
  }

  private getRecipientIdForLog(channel: string, recipient: Recipient): string {
    switch (channel) {
      case 'telegram':
        return recipient.telegramChatId ?? 'unknown';
      case 'max':
        return recipient.maxChatId ?? 'unknown';
      default:
        return recipient.phone;
    }
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
