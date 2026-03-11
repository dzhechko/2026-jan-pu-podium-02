import type { PrismaClient } from '@prisma/client';
import type { DashboardQuery } from './schema.js';

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getDashboard(adminId: string, query: DashboardQuery) {
    const days = PERIOD_DAYS[query.period] ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalSmsSent, totalReviews, positiveCount, negativeCount, avgRatingResult, reviewsByDay] =
      await Promise.all([
        // Total SMS sent
        this.prisma.smsLog.count({
          where: {
            reviewRequest: { adminId },
            status: 'SENT',
            sentAt: { gte: since },
          },
        }),

        // Total reviews
        this.prisma.review.count({
          where: { adminId, createdAt: { gte: since } },
        }),

        // Positive reviews
        this.prisma.review.count({
          where: { adminId, sentiment: 'POSITIVE', createdAt: { gte: since } },
        }),

        // Negative reviews
        this.prisma.review.count({
          where: { adminId, sentiment: 'NEGATIVE', createdAt: { gte: since } },
        }),

        // Average rating
        this.prisma.review.aggregate({
          where: { adminId, createdAt: { gte: since } },
          _avg: { stars: true },
        }),

        // Reviews by day (raw query for grouping)
        this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM reviews
          WHERE admin_id = ${adminId}::uuid
            AND created_at >= ${since}
          GROUP BY DATE(created_at)
          ORDER BY date
        `,
      ]);

    const conversionRate = totalSmsSent > 0 ? totalReviews / totalSmsSent : 0;

    return {
      total_sms_sent: totalSmsSent,
      total_reviews: totalReviews,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      positive_count: positiveCount,
      negative_count: negativeCount,
      avg_rating: Math.round((avgRatingResult._avg.stars ?? 0) * 10) / 10,
      reviews_by_day: reviewsByDay.map((r) => ({
        date: String(r.date).slice(0, 10),
        count: Number(r.count),
      })),
    };
  }

  async getChannelBreakdown(adminId: string, query: DashboardQuery) {
    const days = PERIOD_DAYS[query.period] ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [sentByChannel, reviewsByChannel, fallbackCount] = await Promise.all([
      // Messages sent per channel
      this.prisma.$queryRaw<Array<{ channel: string; sent: bigint; failed: bigint }>>`
        SELECT
          COALESCE(sl.channel, 'sms') as channel,
          COUNT(*) FILTER (WHERE sl.status = 'SENT') as sent,
          COUNT(*) FILTER (WHERE sl.status = 'FAILED') as failed
        FROM sms_logs sl
        JOIN review_requests rr ON sl.review_request_id = rr.id
        WHERE rr.admin_id = ${adminId}::uuid
          AND sl.sent_at >= ${since}
        GROUP BY sl.channel
      `,

      // Reviews received per original channel
      this.prisma.$queryRaw<Array<{ channel: string; count: bigint }>>`
        SELECT
          COALESCE(rr.channel, 'sms') as channel,
          COUNT(*) as count
        FROM reviews r
        JOIN review_requests rr ON r.review_request_id = rr.id
        WHERE r.admin_id = ${adminId}::uuid
          AND r.created_at >= ${since}
        GROUP BY rr.channel
      `,

      // Fallback events count
      this.prisma.smsLog.count({
        where: {
          reviewRequest: { adminId },
          messagePreview: { startsWith: 'Fallback' },
          sentAt: { gte: since },
        },
      }),
    ]);

    const channels = ['sms', 'telegram', 'max'].map((ch) => {
      const sentRow = sentByChannel.find((r) => r.channel === ch);
      const reviewRow = reviewsByChannel.find((r) => r.channel === ch);
      const sent = Number(sentRow?.sent ?? 0);
      const failed = Number(sentRow?.failed ?? 0);
      const reviews = Number(reviewRow?.count ?? 0);
      const conversionRate = sent > 0 ? Math.round((reviews / sent) * 100) / 100 : 0;

      return {
        channel: ch,
        sent,
        failed,
        reviews,
        conversion_rate: conversionRate,
      };
    });

    return {
      channels,
      fallback_count: fallbackCount,
    };
  }
}
