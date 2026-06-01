// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { corsHeaders, jsonWithCors } from './cors';

interface WindowCounter {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowCounter>();

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepExpired(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

function getConfig(): RateLimitConfig {
  const limit = parsePositiveInt(
    process.env.A2UI_RATE_LIMIT_PER_MIN,
    20,
  );
  const windowMs = parsePositiveInt(
    process.env.A2UI_RATE_LIMIT_WINDOW_MS,
    60_000,
  );
  return { limit, windowMs };
}

function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  // Fallback when running locally without a proxy.
  return 'unknown';
}

export interface RateLimitDecision {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export function checkRateLimit(req: Request): RateLimitDecision {
  const { limit, windowMs } = getConfig();
  const now = Date.now();
  sweepExpired(now);

  const key = getClientKey(req);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const next: WindowCounter = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: next.resetAt,
      retryAfterSec: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: 0,
  };
}

function applyRateLimitHeaders(
  headers: Headers,
  decision: RateLimitDecision,
): Headers {
  headers.set('X-RateLimit-Limit', String(decision.limit));
  headers.set('X-RateLimit-Remaining', String(decision.remaining));
  headers.set(
    'X-RateLimit-Reset',
    String(Math.ceil(decision.resetAt / 1000)),
  );
  if (!decision.ok) {
    headers.set('Retry-After', String(decision.retryAfterSec));
  }
  return headers;
}

export function rateLimitJsonResponse(
  req: Request,
  decision: RateLimitDecision,
) {
  const headers = applyRateLimitHeaders(new Headers(), decision);
  return jsonWithCors(
    req,
    {
      ok: false,
      error: 'rate limit exceeded, please retry later',
      retryAfterSec: decision.retryAfterSec,
    },
    { status: 429, headers },
  );
}

export function rateLimitSseResponse(
  req: Request,
  decision: RateLimitDecision,
): Response {
  const payload = JSON.stringify({
    message: 'rate limit exceeded, please retry later',
    retryAfterSec: decision.retryAfterSec,
  });
  const body = new TextEncoder().encode(`event: error\ndata: ${payload}\n\n`);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
  const headers = applyRateLimitHeaders(
    corsHeaders(req, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }),
    decision,
  );
  return new Response(stream, { status: 429, headers });
}
