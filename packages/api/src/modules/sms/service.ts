import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { MessageGateway, MessageSendResult, Recipient } from '../../services/message-gateway.js';
import type { EncryptionService } from '../../services/encryption.js';
import type { SmsTemplateService } from './template-service.js';
import type { ListReviewRequestsQuery } from './schema.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export class ReviewRequestService {
  constructor(
    private prisma: PrismaClient,
    private gateway: MessageGateway,
    private encryption: EncryptionService,
    private pwaUrl: string,
    private templateService?: SmsTemplateService,
  ) {}

  async sendReviewRequests(adminId: string, clientIds: string[], requestedChannel?: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    let sent = 0;
    let failed = 0;

    for (const clientId of clientIds) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, adminId },
      });

      if (!client || client.optedOut) {
        failed++;
        continue;
      }

      // Determine channel: explicit request > client preference > sms
      const channel = requestedChannel ?? client.preferredChannel ?? 'sms';

      const token = randomUUID().replace(/-/g, '');
      const now = new Date();

      const phone = this.encryption.decrypt(Buffer.from(client.phoneEncrypted));

      const reviewRequest = await this.prisma.reviewRequest.create({
        data: {
          adminId,
          clientId,
          token,
          status: 'PENDING',
          channel,
          expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
        },
      });

      const link = `${this.pwaUrl}/review/${token}`;
      const optout = `${this.pwaUrl}/optout/${token}`;

      // Build recipient object (decrypt chat IDs)
      const recipient: Recipient = {
        phone,
        telegramChatId: client.telegramChatIdEncrypted
          ? this.encryption.decrypt(Buffer.from(client.telegramChatIdEncrypted))
          : undefined,
        maxChatId: client.maxChatIdEncrypted
          ? this.encryption.decrypt(Buffer.from(client.maxChatIdEncrypted))
          : undefined,
      };

      // Build message fetcher (re-fetches per channel for fallback - AC-9)
      const messageFetcher = async (ch: string): Promise<string> => {
        let msg: string;
        if (this.templateService) {
          msg = await this.templateService.getMessage(adminId, 0, admin.companyName, link, optout, ch);
        } else {
          msg = `${admin.companyName} просит оставить отзыв: ${link}\nОтписка: ${optout}`;
        }
        // Append bot deep link to SMS if bot configured and client not yet linked
        if (ch === 'sms' && admin.telegramBotUsername && !client.telegramChatIdEncrypted) {
          msg += `\nTelegram: t.me/${admin.telegramBotUsername}?start=${client.id}`;
        }
        return msg;
      };

      // Send via gateway (per-admin providers, handles fallback + template re-fetch)
      const result = await this.gateway.send(adminId, channel, recipient, messageFetcher);

      if (result.success) {
        await this.prisma.reviewRequest.update({
          where: { id: reviewRequest.id },
          data: {
            status: 'SMS_SENT',
            smsSentAt: now,
            nextReminderAt: new Date(now.getTime() + TWO_HOURS_MS),
            // Update channel if fallback occurred
            channel: result.actualChannel,
          },
        });
        await this.createMessageLog(reviewRequest.id, result, channel, recipient, now);
        sent++;
      } else {
        await this.createMessageLog(reviewRequest.id, result, channel, recipient, null);
        failed++;
      }
    }

    return { sent, failed };
  }

  private async createMessageLog(
    reviewRequestId: string,
    result: MessageSendResult,
    requestedChannel: string,
    recipient: Recipient,
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

  async listReviewRequests(adminId: string, query: ListReviewRequestsQuery) {
    const where: Record<string, unknown> = { adminId };
    if (query.status) {
      where.status = query.status;
    }

    const [requests, total] = await Promise.all([
      this.prisma.reviewRequest.findMany({
        where,
        include: { client: { select: { name: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => ({
        id: r.id,
        client_name: r.client.name,
        token: r.token,
        status: r.status,
        reminder_count: r.reminderCount,
        sms_sent_at: r.smsSentAt?.toISOString() ?? null,
        expires_at: r.expiresAt.toISOString(),
        created_at: r.createdAt.toISOString(),
      })),
      meta: { total, page: query.page, limit: query.limit },
    };
  }
}
