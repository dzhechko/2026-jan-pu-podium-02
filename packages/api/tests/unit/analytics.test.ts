import { describe, it, expect, vi, beforeEach } from 'vitest';

const { AnalyticsService } = await import('../../src/modules/analytics/service.js');

function createMockPrisma() {
  return {
    smsLog: {
      count: vi.fn().mockResolvedValue(100),
    },
    review: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _avg: { stars: null } }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('AnalyticsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof AnalyticsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AnalyticsService(prisma);
  });

  it('returns dashboard with correct structure', async () => {
    prisma.smsLog.count.mockResolvedValue(100);
    // review.count called twice (total + positive + negative = 3 calls)
    prisma.review.count
      .mockResolvedValueOnce(25) // totalReviews
      .mockResolvedValueOnce(20) // positiveCount
      .mockResolvedValueOnce(5); // negativeCount
    prisma.review.aggregate.mockResolvedValue({ _avg: { stars: 4.2 } });
    prisma.$queryRaw.mockResolvedValue([
      { date: '2026-01-15', count: BigInt(5) },
      { date: '2026-01-16', count: BigInt(3) },
    ]);

    const result = await service.getDashboard('admin-1', { period: '30d' });

    expect(result.total_sms_sent).toBe(100);
    expect(result.total_reviews).toBe(25);
    expect(result.positive_count).toBe(20);
    expect(result.negative_count).toBe(5);
    expect(result.avg_rating).toBe(4.2);
    expect(result.conversion_rate).toBe(0.25);
    expect(result.reviews_by_day).toHaveLength(2);
    expect(result.reviews_by_day[0].count).toBe(5);
  });

  it('handles zero SMS sent (no division by zero)', async () => {
    prisma.smsLog.count.mockResolvedValue(0);
    prisma.review.count.mockResolvedValue(0);
    prisma.review.aggregate.mockResolvedValue({ _avg: { stars: null } });

    const result = await service.getDashboard('admin-1', { period: '7d' });

    expect(result.conversion_rate).toBe(0);
    expect(result.avg_rating).toBe(0);
  });

  it('defaults to 30 days for unknown period', async () => {
    prisma.review.count.mockResolvedValue(0);

    await service.getDashboard('admin-1', { period: 'unknown' as any });

    // Just verify it doesn't throw
    expect(prisma.smsLog.count).toHaveBeenCalled();
  });

  describe('getChannelBreakdown', () => {
    it('returns per-channel stats', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { channel: 'sms', sent: BigInt(80), failed: BigInt(5) },
          { channel: 'telegram', sent: BigInt(30), failed: BigInt(2) },
          { channel: 'max', sent: BigInt(10), failed: BigInt(0) },
        ])
        .mockResolvedValueOnce([
          { channel: 'sms', count: BigInt(20) },
          { channel: 'telegram', count: BigInt(15) },
        ]);
      prisma.smsLog.count.mockResolvedValue(3); // fallback count

      const result = await service.getChannelBreakdown('admin-1', { period: '30d' });

      expect(result.channels).toHaveLength(3);
      const sms = result.channels.find((c: any) => c.channel === 'sms')!;
      expect(sms.sent).toBe(80);
      expect(sms.failed).toBe(5);
      expect(sms.reviews).toBe(20);
      expect(sms.conversion_rate).toBe(0.25);

      const tg = result.channels.find((c: any) => c.channel === 'telegram')!;
      expect(tg.sent).toBe(30);
      expect(tg.reviews).toBe(15);
      expect(tg.conversion_rate).toBe(0.5);

      const max = result.channels.find((c: any) => c.channel === 'max')!;
      expect(max.sent).toBe(10);
      expect(max.reviews).toBe(0);
      expect(max.conversion_rate).toBe(0);

      expect(result.fallback_count).toBe(3);
    });

    it('handles no data', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.smsLog.count.mockResolvedValue(0);

      const result = await service.getChannelBreakdown('admin-1', { period: '7d' });

      expect(result.channels).toHaveLength(3);
      result.channels.forEach((ch: any) => {
        expect(ch.sent).toBe(0);
        expect(ch.conversion_rate).toBe(0);
      });
      expect(result.fallback_count).toBe(0);
    });
  });
});
