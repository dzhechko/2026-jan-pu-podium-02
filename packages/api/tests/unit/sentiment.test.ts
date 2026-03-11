import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
function createMockPrisma() {
  return {
    review: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

// Mock LLM
function createMockLlm() {
  return {
    analyzeSentiment: vi.fn(),
  } as any;
}

// Use dynamic import to avoid ESM issues
const { SentimentService } = await import('../../src/modules/sentiment/service.js');

describe('SentimentService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let llm: ReturnType<typeof createMockLlm>;
  let service: InstanceType<typeof SentimentService>;

  const mockReview = {
    id: 'review-1',
    text: 'Отличный сервис!',
    stars: 5,
    admin: {
      yandexMapsUrl: 'https://yandex.ru/maps/org/123',
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    llm = createMockLlm();
    service = new SentimentService(prisma, llm);
    prisma.review.findUniqueOrThrow.mockResolvedValue(mockReview);
    prisma.review.update.mockResolvedValue({});
  });

  it('routes positive high-confidence to YANDEX_REDIRECT', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'positive', confidence: 0.85 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.sentiment).toBe('POSITIVE');
    expect(result.routed_to).toBe('YANDEX_REDIRECT');
    expect(result.redirect_url).toBe('https://yandex.ru/maps/org/123');
    expect(result.promo_code).toBeNull();
  });

  it('routes positive low-confidence with high stars to YANDEX_REDIRECT', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'positive', confidence: 0.6 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.routed_to).toBe('YANDEX_REDIRECT');
  });

  it('routes positive low-confidence with low stars to INTERNAL_HIDDEN', async () => {
    prisma.review.findUniqueOrThrow.mockResolvedValue({ ...mockReview, stars: 3 });
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'positive', confidence: 0.6 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.routed_to).toBe('INTERNAL_HIDDEN');
    expect(result.promo_code).toMatch(/^RH-[A-F0-9]{8}$/);
  });

  it('routes negative to INTERNAL_HIDDEN with promo code', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'negative', confidence: 0.9 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.sentiment).toBe('NEGATIVE');
    expect(result.routed_to).toBe('INTERNAL_HIDDEN');
    expect(result.promo_code).toMatch(/^RH-[A-F0-9]{8}$/);
    expect(result.redirect_url).toBeNull();
  });

  it('uses confidence threshold 0.7 boundary — below', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'positive', confidence: 0.69 });
    prisma.review.findUniqueOrThrow.mockResolvedValue({ ...mockReview, stars: 3 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.routed_to).toBe('INTERNAL_HIDDEN');
  });

  it('uses confidence threshold 0.7 boundary — at threshold', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'positive', confidence: 0.7 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.routed_to).toBe('YANDEX_REDIRECT');
  });

  it('falls back to star rating when LLM fails', async () => {
    llm.analyzeSentiment.mockRejectedValue(new Error('API down'));

    const result = await service.analyzeAndRoute('review-1');

    expect(result.sentiment).toBe('POSITIVE');
    expect(result.confidence).toBe(0.5);
  });

  it('falls back to negative for low stars when LLM fails', async () => {
    llm.analyzeSentiment.mockRejectedValue(new Error('API down'));
    prisma.review.findUniqueOrThrow.mockResolvedValue({ ...mockReview, stars: 2 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.sentiment).toBe('NEGATIVE');
    expect(result.routed_to).toBe('INTERNAL_HIDDEN');
  });

  it('handles neutral sentiment as INTERNAL_HIDDEN', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'neutral', confidence: 0.8 });

    const result = await service.analyzeAndRoute('review-1');

    expect(result.routed_to).toBe('INTERNAL_HIDDEN');
  });

  it('generates unique promo codes', async () => {
    llm.analyzeSentiment.mockResolvedValue({ sentiment: 'negative', confidence: 0.9 });

    const result1 = await service.analyzeAndRoute('review-1');
    const result2 = await service.analyzeAndRoute('review-1');

    expect(result1.promo_code).not.toBe(result2.promo_code);
  });
});
