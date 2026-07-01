// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Retry `fn` up to `maxAttempts` times with exponential backoff.
 * Backoff: 500ms, 1000ms, 2000ms, ... (base * 2^attempt).
 *
 * Only retries on errors classified by `isTransient`. Non-transient errors
 * fail fast.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    isTransient?: (err: unknown) => boolean;
    onAttempt?: (attempt: number, err: unknown) => void;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const isTransient = options.isTransient ?? defaultIsTransient;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isTransient(err)) {
        throw err;
      }
      options.onAttempt?.(attempt, err);
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function defaultIsTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('econnreset')
    || msg.includes('etimedout')
    || msg.includes('rate limit')
    || msg.includes('429')
    || msg.includes('503')
    || msg.includes('504')
    || msg.includes('socket hang up');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
