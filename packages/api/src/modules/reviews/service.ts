import type { PrismaClient } from '@prisma/client';
import type { SentimentService } from '../sentiment/service.js';
import type { SubmitReviewInput, ListReviewsQuery } from './schema.js';

export class ReviewService {
  private sentimentService: SentimentService | null = null;

  constructor(private prisma: PrismaClient) {}

  setSentimentService(service: SentimentService) {
    this.sentimentService = service;
  }

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

    // Run sentiment analysis (LLM with star-rating fallback)
    const sentimentResult = this.sentimentService
      ? await this.sentimentService.analyzeAndRoute(review.id)
      : null;

    const sentiment = sentimentResult?.sentiment ?? (input.stars >= 4 ? 'POSITIVE' : 'NEGATIVE');
    const routedTo = sentimentResult?.routed_to ?? (input.stars >= 4 ? 'YANDEX_REDIRECT' : 'INTERNAL_HIDDEN');
    const promoCode = sentimentResult?.promo_code ?? null;
    const redirectUrl = routedTo === 'YANDEX_REDIRECT' && request.admin.yandexMapsUrl
      ? request.admin.yandexMapsUrl
      : null;

    // Update if sentiment service wasn't available
    if (!sentimentResult) {
      await this.prisma.review.update({
        where: { id: review.id },
        data: { sentiment, routedTo, sentimentConfidence: 0.5 },
      });
    }

    return {
      data: {
        sentiment,
        redirect_url: redirectUrl,
        promo_code: promoCode,
        discount_text: routedTo === 'INTERNAL_HIDDEN' ? request.admin.discountText : null,
        discount_percent: routedTo === 'INTERNAL_HIDDEN' ? request.admin.discountPercent : null,
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
