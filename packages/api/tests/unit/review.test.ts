import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ReviewService } = await import('../../src/modules/reviews/service.js');

function createMockPrisma() {
  return {
    reviewRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    review: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    client: {
      update: vi.fn(),
    },
  } as any;
}

describe('ReviewService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof ReviewService>;

  const mockRequest = {
    id: 'req-1',
    adminId: 'admin-1',
    clientId: 'client-1',
    token: 'token-abc',
    expiresAt: new Date(Date.now() + 86400000),
    reviews: [],
    admin: {
      companyName: 'TestCo',
      yandexMapsUrl: 'https://yandex.ru/maps/org/123',
      discountText: 'Скидка 10%',
      discountPercent: 10,
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReviewService(prisma);
    prisma.reviewRequest.findUnique.mockResolvedValue(mockRequest);
    prisma.reviewRequest.update.mockResolvedValue({});
    prisma.review.create.mockResolvedValue({ id: 'rev-1' });
    prisma.review.update.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
  });

  describe('getFormData', () => {
    it('returns company data for valid token', async () => {
      const result = await service.getFormData('token-abc');

      expect(result.data).toEqual({
        company_name: 'TestCo',
        discount_text: 'Скидка 10%',
        discount_percent: 10,
      });
    });

    it('returns NOT_FOUND for invalid token', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue(null);

      const result = await service.getFormData('bad-token');

      expect(result.error).toBe('NOT_FOUND');
      expect(result.status).toBe(404);
    });

    it('returns EXPIRED for expired request', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.getFormData('token-abc');

      expect(result.error).toBe('EXPIRED');
    });

    it('returns ALREADY_REVIEWED when review exists', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        reviews: [{ id: 'rev-1' }],
      });

      const result = await service.getFormData('token-abc');

      expect(result.error).toBe('ALREADY_REVIEWED');
    });
  });

  describe('submitReview', () => {
    it('creates review and cancels reminders', async () => {
      const result = await service.submitReview('token-abc', { stars: 5, text: 'Отлично!' });

      expect(prisma.review.create).toHaveBeenCalled();
      expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REVIEWED', nextReminderAt: null },
      });
      expect(result.data).toBeDefined();
    });

    it('routes high stars to YANDEX_REDIRECT without sentiment service', async () => {
      const result = await service.submitReview('token-abc', { stars: 5, text: 'Отлично!' });

      expect(result.data!.sentiment).toBe('POSITIVE');
      expect(result.data!.redirect_url).toBe('https://yandex.ru/maps/org/123');
    });

    it('routes low stars to INTERNAL_HIDDEN without sentiment service', async () => {
      const result = await service.submitReview('token-abc', { stars: 2, text: 'Плохо' });

      expect(result.data!.sentiment).toBe('NEGATIVE');
      expect(result.data!.redirect_url).toBeNull();
      expect(result.data!.discount_text).toBe('Скидка 10%');
    });

    it('returns error for expired request', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.submitReview('token-abc', { stars: 5, text: 'test' });

      expect(result.error).toBe('EXPIRED');
    });

    it('returns error for already-reviewed request', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        reviews: [{ id: 'rev-1' }],
      });

      const result = await service.submitReview('token-abc', { stars: 5, text: 'test' });

      expect(result.error).toBe('ALREADY_REVIEWED');
    });
  });

  describe('optOut', () => {
    it('marks client as opted out and cancels reminders', async () => {
      const result = await service.optOut('token-abc');

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { optedOut: true },
      });
      expect(prisma.reviewRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'OPTED_OUT', nextReminderAt: null },
      });
      expect(result.data!.message).toContain('отписаны');
    });

    it('returns NOT_FOUND for invalid token', async () => {
      prisma.reviewRequest.findUnique.mockResolvedValue(null);

      const result = await service.optOut('bad-token');

      expect(result.error).toBe('NOT_FOUND');
    });
  });
});
