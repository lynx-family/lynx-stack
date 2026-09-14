// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { setTimeout as sleep } from 'node:timers/promises';

export type BenchRetrySleep = (
  delayMs: number,
  signal?: AbortSignal,
) => Promise<void>;

const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Follow the latest SDK error instead of diagnostics from previous attempts. */
function errorChain(error: unknown): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = [];
  let current = error;
  while (isRecord(current) && chain.length < 8 && !chain.includes(current)) {
    chain.push(current);
    current = current.lastError ?? current.cause;
  }
  return chain;
}

function retryAfter(headers: unknown, now: number): number | undefined {
  const value = headers instanceof Headers
    ? headers.get('retry-after')
    : (isRecord(headers)
      ? Object.entries(headers).find(([name]) =>
        name.toLowerCase() === 'retry-after'
      )?.[1]
      : undefined);
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/u.test(trimmed)) {
    return Math.ceil(Number(trimmed) * 1_000);
  }
  // Reject numeric junk instead of letting Date.parse interpret it as a date.
  if (!/^[A-Za-z]/u.test(trimmed)) return undefined;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

/** Undefined means stop; transport retries share the adapter's attempt budget. */
export function resolveBenchRetryDelay(
  error: unknown,
  attempt: number,
  options: { retryDelayMs?: number | undefined; now?: number } = {},
): number | undefined {
  const chain = errorChain(error);
  if (
    chain.some(item =>
      item.name === 'AbortError' || item.code === 'ABORT_ERR'
      || item.code === 'ERR_ABORTED' || item.isRetryable === false
    )
  ) return undefined;

  const status = chain.find(item =>
    typeof item.statusCode === 'number' && Number.isInteger(item.statusCode)
    && item.statusCode >= 100 && item.statusCode <= 599
  )?.statusCode;
  const retryable = typeof status === 'number'
    ? status === 408 || status === 409 || status === 429 || status >= 500
    : chain.some(item =>
      item.isRetryable === true
      || item.name === 'TimeoutError'
      || (typeof item.code === 'string'
        && TRANSIENT_NETWORK_CODES.has(item.code))
      || (item.name === 'TypeError' && item.message === 'fetch failed')
    );
  if (!retryable) return undefined;

  const now = options.now ?? Date.now();
  for (const item of chain) {
    const delay = retryAfter(item.responseHeaders, now);
    if (delay !== undefined) {
      // Never shorten the provider's minimum wait. Stop if it exceeds our budget.
      return delay <= MAX_RETRY_DELAY_MS ? delay : undefined;
    }
  }
  const baseDelay = options.retryDelayMs !== undefined
      && Number.isFinite(options.retryDelayMs)
    ? Math.max(0, Math.floor(options.retryDelayMs))
    : DEFAULT_RETRY_DELAY_MS;
  const exponent = Number.isFinite(attempt)
    ? Math.min(6, Math.max(0, Math.floor(attempt) - 1))
    : 0;
  return Math.min(MAX_RETRY_DELAY_MS, baseDelay * 2 ** exponent);
}

const defaultRetrySleep: BenchRetrySleep = async (delayMs, signal) => {
  signal?.throwIfAborted();
  if (delayMs > 0) await sleep(delayMs, undefined, { signal });
};

/** Cancellation must also interrupt injected waits that do not observe the signal. */
export async function waitForBenchRetry(
  delayMs: number,
  signal?: AbortSignal,
  wait: BenchRetrySleep = defaultRetrySleep,
): Promise<void> {
  signal?.throwIfAborted();
  if (!signal) {
    await wait(delayMs);
    return;
  }
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () =>
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError'),
      );
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return wait(delayMs, signal);
      }),
      aborted,
    ]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
  signal.throwIfAborted();
}
