// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { resolveBenchRetryDelay } from '../service/common/bench/retry.js';
import { GenerationUpstreamError } from '../service/common/result.js';

test.each([408, 409, 429, 500, 502, 503, 504])(
  'backs off transient HTTP %s within the existing attempt budget',
  (statusCode) => {
    expect(
      [1, 2, 3].map(attempt => resolveBenchRetryDelay({ statusCode }, attempt)),
    ).toEqual([1_000, 2_000, 4_000]);
  },
);

test.each([
  { statusCode: 400, isRetryable: true },
  { statusCode: 401 },
  { statusCode: 403 },
  { statusCode: 404 },
  { statusCode: 422 },
  { statusCode: 429, isRetryable: false },
  { name: 'AbortError', cause: { statusCode: 503 } },
  { code: 'ABORT_ERR' },
  new Error('configuration missing'),
  new TypeError('invalid options'),
  { code: 'ENOTFOUND' },
])('does not retry permanent, cancelled, or unknown errors: %j', (error) => {
  expect(resolveBenchRetryDelay(error, 1)).toBeUndefined();
});

test.each([
  { cause: { code: 'ECONNRESET' } },
  { cause: { code: 'ETIMEDOUT' } },
  { cause: { code: 'EAI_AGAIN' } },
  { cause: { code: 'UND_ERR_SOCKET' } },
  new TypeError('fetch failed'),
  { name: 'TimeoutError' },
  { isRetryable: true },
])('recognizes transient network failures: %j', (error) => {
  expect(resolveBenchRetryDelay(error, 1)).toBe(1_000);
});

test('unwraps SDK retries and upstream result errors using the latest error', () => {
  const error = new GenerationUpstreamError({
    name: 'AI_RetryError',
    lastError: {
      statusCode: 429,
      responseHeaders: { 'Retry-After': '3' },
    },
    errors: [{ statusCode: 401 }],
  }, { text: '', usage: undefined, finishReason: 'error' });
  expect(resolveBenchRetryDelay(error, 1)).toBe(3_000);
  expect(resolveBenchRetryDelay({
    lastError: { statusCode: 401 },
    errors: [{ statusCode: 503 }],
  }, 1)).toBeUndefined();
});

test.each(
  [
    ['0', 0],
    ['0.25', 250],
    [' 2 ', 2_000],
    ['Thu, 10 Sep 2026 00:00:05 GMT', 5_000],
    ['Thu, 10 Sep 2026 00:00:00 GMT', 0],
    ['60', 60_000],
    ['61', undefined],
    ['9'.repeat(400), undefined],
    ['invalid', 1_000],
    ['-1', 1_000],
    ['', 1_000],
  ] as const,
)('handles Retry-After %s without retrying before it', (value, expected) => {
  const error = { statusCode: 429, responseHeaders: { 'ReTrY-AfTeR': value } };
  expect(resolveBenchRetryDelay(error, 1, {
    now: Date.parse('2026-09-10T00:00:00Z'),
  })).toBe(expected);
});

test('supports Headers and prioritizes Retry-After over the fallback delay', () => {
  expect(resolveBenchRetryDelay(
    {
      statusCode: 503,
      responseHeaders: new Headers({ 'Retry-After': '2' }),
    },
    3,
    { retryDelayMs: 0 },
  )).toBe(2_000);
});

test('bounds malformed configuration and cyclic error causes', () => {
  const error = { statusCode: 503, cause: {} };
  error.cause = error;
  expect(resolveBenchRetryDelay(error, 99)).toBe(60_000);
  expect(resolveBenchRetryDelay(error, 1, { retryDelayMs: Number.NaN })).toBe(
    1_000,
  );
  expect(resolveBenchRetryDelay(error, 2, { retryDelayMs: -1 })).toBe(0);
});
