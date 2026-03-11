import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { LlmService } from '../../services/llm.js';

export class SentimentService {
  constructor(
    private prisma: PrismaClient,
    private llm: LlmService,
  ) {}

  async analyzeAndRoute(reviewId: string) {
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: { admin: true },
    });

    let sentiment: string;
    let confidence: number;

    try {
      const result = await this.llm.analyzeSentiment(review.text);
      sentiment = result.sentiment.toUpperCase();
      confidence = result.confidence;
    } catch (err) {
      // Fallback: use star rating
      console.warn('LLM fallback used for review', reviewId, err);
      sentiment = review.stars >= 4 ? 'POSITIVE' : 'NEGATIVE';
      confidence = 0.5;
    }

    // Routing decision
    let routedTo: string;
    if (sentiment === 'POSITIVE' && confidence >= 0.7) {
      routedTo = 'YANDEX_REDIRECT';
    } else if (sentiment === 'POSITIVE' && confidence < 0.7) {
      routedTo = review.stars >= 4 ? 'YANDEX_REDIRECT' : 'INTERNAL_HIDDEN';
    } else {
      routedTo = 'INTERNAL_HIDDEN';
    }

    // Generate promo code for negative/internal reviews
    const promoCode = routedTo === 'INTERNAL_HIDDEN'
      ? 'RH-' + randomBytes(4).toString('hex').toUpperCase()
      : null;

    const redirectUrl = routedTo === 'YANDEX_REDIRECT' && review.admin.yandexMapsUrl
      ? review.admin.yandexMapsUrl
      : null;

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        sentiment,
        sentimentConfidence: confidence,
        routedTo,
        promoCode,
      },
    });

    return {
      sentiment,
      confidence,
      routed_to: routedTo,
      redirect_url: redirectUrl,
      promo_code: promoCode,
    };
  }
}
