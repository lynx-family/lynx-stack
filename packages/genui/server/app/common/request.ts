// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

export const MAX_BODY_BYTES = parsePositiveInt(
  process.env.A2UI_MAX_BODY_BYTES,
  64 * 1024,
);

export interface JsonBodyMetrics {
  declaredByteLength?: number;
  rawByteLength?: number;
  readMs?: number;
  parseMs?: number;
  totalMs: number;
}

export async function readJsonBodyWithLimit<T>(
  req: Request,
): Promise<
  | { ok: true; body: T; metrics: JsonBodyMetrics }
  | { ok: false; status: number; error: string; metrics: JsonBodyMetrics }
> {
  const startedAt = performance.now();
  const declaredLength = req.headers.get('content-length');
  const declaredByteLength = declaredLength
    ? Number(declaredLength)
    : undefined;
  if (
    declaredLength
    && declaredByteLength !== undefined
    && Number.isFinite(declaredByteLength)
    && declaredByteLength > MAX_BODY_BYTES
  ) {
    return {
      ok: false,
      status: 413,
      error: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      metrics: {
        declaredByteLength,
        totalMs: performance.now() - startedAt,
      },
    };
  }

  let raw: string;
  const readStartedAt = performance.now();
  try {
    raw = await req.text();
  } catch {
    const now = performance.now();
    return {
      ok: false,
      status: 400,
      error: 'failed to read request body',
      metrics: {
        declaredByteLength,
        readMs: now - readStartedAt,
        totalMs: now - startedAt,
      },
    };
  }
  const readEndedAt = performance.now();

  const rawByteLength = Buffer.byteLength(raw, 'utf8');
  if (rawByteLength > MAX_BODY_BYTES) {
    const now = performance.now();
    return {
      ok: false,
      status: 413,
      error: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        totalMs: now - startedAt,
      },
    };
  }

  const parseStartedAt = performance.now();
  try {
    const body = JSON.parse(raw) as T;
    const now = performance.now();
    return {
      ok: true,
      body,
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        parseMs: now - parseStartedAt,
        totalMs: now - startedAt,
      },
    };
  } catch {
    const now = performance.now();
    return {
      ok: false,
      status: 400,
      error: 'invalid JSON body',
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        parseMs: now - parseStartedAt,
        totalMs: now - startedAt,
      },
    };
  }
}
