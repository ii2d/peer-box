import { describe, it, expect, vi } from 'vitest';
import {
  submitIndexNow,
  INDEXNOW_KEY,
  INDEXNOW_HOST,
  INDEXNOW_ENDPOINT,
  INDEXNOW_URLS,
} from './submit-indexnow.mjs';

describe('submitIndexNow', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips submission gracefully when no key is provided', async () => {
    const mockFetch = vi.fn();
    const result = await submitIndexNow(mockFetch, '');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts payload to IndexNow endpoint and reports success on 200/202', async () => {
    const testKey = 'test-key-12345';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    const result = await submitIndexNow(mockFetch, testKey);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: testKey,
          keyLocation: `https://${INDEXNOW_HOST}/${testKey}.txt`,
          urlList: INDEXNOW_URLS,
        }),
      }),
    );
  });

  it('handles HTTP error status gracefully without throwing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    });

    const result = await submitIndexNow(mockFetch, 'test-key-12345');
    expect(result.success).toBe(false);
    expect(result.status).toBe(422);
  });

  it('catches network rejection and returns error object', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    const result = await submitIndexNow(mockFetch, 'test-key-12345');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
