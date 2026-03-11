import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { SubmitReviewInput, ListReviewsQuery } from './schema.js';

export class ReviewService {
  constructor(private prisma: PrismaClient) {}

  async getFormData(token: string) {
    const request = await this.prisma.reviewRequest.findUnique({
      where: { token },
      include: { admin: true, reviews: { select: { id: true } } },
    });

    if (!request) {
      return { error: 'NOT_FOUND', status: 404 };
    }

    if (request.expiresAt < new Date()) {
      return { error: 'EXPIRED', status: 410 };
    }

    if (request.reviews.length > 0) {
      return { error: 'ALREADY_REVIEWED', status: 410 };
    }

    return {
      data: {
        company_name: request.admin.companyName,
        discount_text: request.admin.discountText,
        discount_percent: request.admin.discountPercent,
      },
    };
  }

  async submitReview(token: string, input: SubmitReviewInput) {
    const request = await this.prisma.reviewRequest.findUnique({
      where: { token },
      include: { admin: true, reviews: { select: { id: true } } },
    });

    if (!request) {
      return { error: 'NOT_FOUND', status: 404 };
    }

    if (request.expiresAt < new Date()) {
      return { error: 'EXPIRED', status: 410 };
    }

    if (request.reviews.length > 0) {
      return { error: 'ALREADY_REVIEWED', status: 410 };
    }

    // Create review (sentiment will be filled by sentiment-analysis feature)
    const review = await this.prisma.review.create({
      data: {
        reviewRequestId: request.id,
        adminId: request.adminId,
        clientId: request.clientId,
        stars: input.stars,
        text: input.text,
      },
    });

    // Mark request as reviewed, cancel reminders
    await this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        status: 'REVIEWED',
        nextReminderAt: null,
      },
    });

    // Simple star-based routing (LLM sentiment overrides later)
    const isPositive = input.stars >= 4;
    let redirectUrl: string | null = null;
    let promoCode: string | null = null;

    if (isPositive && request.admin.yandexMapsUrl) {
      redirectUrl = request.admin.yandexMapsUrl;
    } else {
      promoCode = generatePromoCode();
      await this.prisma.review.update({
        where: { id: review.id },
        data: {
          sentiment: 'NEGATIVE',
          routedTo: 'INTERNAL_HIDDEN',
          promoCode,
        },
      });
    }

    if (isPositive) {
      await this.prisma.review.update({
        where: { id: review.id },
        data: {
          sentiment: 'POSITIVE',
          routedTo: 'YANDEX_REDIRECT',
        },
      });
    }

    return {
      data: {
        sentiment: isPositive ? 'POSITIVE' : 'NEGATIVE',
        redirect_url: redirectUrl,
        promo_code: promoCode,
        discount_text: !isPositive ? request.admin.discountText : null,
        discount_percent: !isPositive ? request.admin.discountPercent : null,
      },
    };
  }

  async optOut(token: string) {
    const request = await this.prisma.reviewRequest.findUnique({
      where: { token },
    });

    if (!request) {
      return { error: 'NOT_FOUND', status: 404 };
    }

    await this.prisma.client.update({
      where: { id: request.clientId },
      data: { optedOut: true },
    });

    await this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: 'OPTED_OUT', nextReminderAt: null },
    });

    return { data: { message: 'Вы отписаны от SMS рассылки' } };
  }

  async listReviews(adminId: string, query: ListReviewsQuery) {
    const where: Record<string, unknown> = { adminId };
    if (query.sentiment) where.sentiment = query.sentiment;
    if (query.date_from || query.date_to) {
      const createdAt: Record<string, Date> = {};
      if (query.date_from) createdAt.gte = new Date(query.date_from);
      if (query.date_to) createdAt.lte = new Date(query.date_to);
      where.createdAt = createdAt;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { client: { select: { name: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews.map((r) => ({
        id: r.id,
        client_name: r.client.name,
        stars: r.stars,
        text: r.text,
        sentiment: r.sentiment,
        routed_to: r.routedTo,
        promo_code: r.promoCode,
        created_at: r.createdAt.toISOString(),
      })),
      meta: { total, page: query.page, limit: query.limit },
    };
  }
}

function generatePromoCode(): string {
  return 'RH-' + randomBytes(4).toString('hex').toUpperCase();
}
