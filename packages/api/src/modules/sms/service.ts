import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { SmscService } from '../../services/smsc.js';
import type { EncryptionService } from '../../services/encryption.js';
import type { SmsTemplateService } from './template-service.js';
import type { ListReviewRequestsQuery } from './schema.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export class ReviewRequestService {
  constructor(
    private prisma: PrismaClient,
    private smsc: SmscService,
    private encryption: EncryptionService,
    private pwaUrl: string,
    private templateService?: SmsTemplateService,
  ) {}

  async sendReviewRequests(adminId: string, clientIds: string[]) {
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

      const token = randomUUID().replace(/-/g, '');
      const now = new Date();

      const reviewRequest = await this.prisma.reviewRequest.create({
        data: {
          adminId,
          clientId,
          token,
          status: 'PENDING',
          expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
        },
      });

      const phone = this.encryption.decrypt(Buffer.from(client.phoneEncrypted));
      const link = `${this.pwaUrl}/review/${token}`;
      const optout = `${this.pwaUrl}/optout/${token}`;

      let message: string;
      if (this.templateService) {
        message = await this.templateService.getMessage(adminId, 0, admin.companyName, link, optout);
      } else {
        message = `${admin.companyName} просит оставить отзыв: ${link}\nОтписка: ${optout}`;
      }

      const result = await this.smsc.sendSms(phone, message);
      const phoneMasked = phone.slice(0, 4) + '****' + phone.slice(-2);

      if (result.success) {
        await this.prisma.reviewRequest.update({
          where: { id: reviewRequest.id },
          data: {
            status: 'SMS_SENT',
            smsSentAt: now,
            nextReminderAt: new Date(now.getTime() + TWO_HOURS_MS),
          },
        });

        await this.prisma.smsLog.create({
          data: {
            reviewRequestId: reviewRequest.id,
            phoneMasked,
            messagePreview: message.slice(0, 100),
            smscMessageId: result.messageId,
            status: 'SENT',
            sentAt: now,
          },
        });
        sent++;
      } else {
        await this.prisma.smsLog.create({
          data: {
            reviewRequestId: reviewRequest.id,
            phoneMasked,
            messagePreview: message.slice(0, 100),
            status: 'FAILED',
          },
        });
        failed++;
      }
    }

    return { sent, failed };
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
