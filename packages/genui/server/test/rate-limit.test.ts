// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { rateLimitJsonResponse } from '../app/common/rate-limit.js';

describe('rateLimitJsonResponse', () => {
  test('preserves rate limit and CORS headers on JSON responses', async () => {
    const response = rateLimitJsonResponse(
      new Request('https://example.test/api', {
        headers: { Origin: 'http://localhost:3000' },
      }),
      {
        ok: false,
        limit: 20,
        remaining: 0,
        resetAt: 1_700_000_000_123,
        retryAfterSec: 12,
      },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    );
    expect(response.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1700000001');
    expect(response.headers.get('Retry-After')).toBe('12');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'rate limit exceeded, please retry later',
      retryAfterSec: 12,
    });
  });
});
