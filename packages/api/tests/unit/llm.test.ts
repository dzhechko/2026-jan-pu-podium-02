import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { LlmService } = await import('../../src/services/llm.js');

describe('LlmService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when API key is not configured', async () => {
    const service = new LlmService('sk-ant-...');

    await expect(service.analyzeSentiment('test')).rejects.toThrow(
      'LLM API key not configured',
    );
  });

  it('throws when API key is empty', async () => {
    const service = new LlmService('');

    await expect(service.analyzeSentiment('test')).rejects.toThrow(
      'LLM API key not configured',
    );
  });

  it('parses positive sentiment from API response', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"sentiment": "positive", "confidence": 0.95}' }],
      }),
    }) as any;

    const result = await service.analyzeSentiment('Отличный сервис!');

    expect(result.sentiment).toBe('positive');
    expect(result.confidence).toBe(0.95);
  });

  it('parses negative sentiment from API response', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"sentiment": "negative", "confidence": 0.8}' }],
      }),
    }) as any;

    const result = await service.analyzeSentiment('Ужасно');

    expect(result.sentiment).toBe('negative');
    expect(result.confidence).toBe(0.8);
  });

  it('extracts JSON from surrounding text', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Here is the analysis:\n{"sentiment": "neutral", "confidence": 0.5}\nDone.' }],
      }),
    }) as any;

    const result = await service.analyzeSentiment('Нормально');

    expect(result.sentiment).toBe('neutral');
  });

  it('throws on non-200 response', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }) as any;

    await expect(service.analyzeSentiment('test')).rejects.toThrow('LLM API error: 429');
  });

  it('throws when response has no JSON', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'I cannot analyze this.' }],
      }),
    }) as any;

    await expect(service.analyzeSentiment('test')).rejects.toThrow('no JSON found');
  });

  it('throws on invalid sentiment value', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"sentiment": "happy", "confidence": 0.9}' }],
      }),
    }) as any;

    await expect(service.analyzeSentiment('test')).rejects.toThrow('Invalid sentiment value');
  });

  it('clamps confidence to 0-1 range', async () => {
    const service = new LlmService('sk-real-key');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"sentiment": "positive", "confidence": 1.5}' }],
      }),
    }) as any;

    const result = await service.analyzeSentiment('test');

    expect(result.confidence).toBe(1);
  });
});
