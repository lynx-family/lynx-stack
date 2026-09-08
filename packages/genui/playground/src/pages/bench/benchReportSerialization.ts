// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BenchReport } from './benchReportTypes.js';
import { createBenchScreenshotReader } from './benchScreenshot.js';
import { BENCH_JOB_ID } from '../../utils/appRoute.js';

function isSensitiveKey(key: string): boolean {
  const normalized = key.replaceAll(/[-_]/gu, '').toLowerCase();
  return normalized === 'apikey'
    || normalized === 'authorization'
    || normalized === 'accesstoken'
    || normalized === 'token'
    || normalized === 'secret'
    || normalized === 'baseurl'
    || normalized === 'screenshotdataurl';
}

function redactString(
  value: string,
  secrets: readonly string[],
  modelName = false,
): string {
  let sanitized = value;
  for (
    const secret of new Set(secrets.map((item) => item.trim()).filter(Boolean))
  ) {
    sanitized = sanitized.replaceAll(secret, '[redacted credential]');
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) {
      sanitized = sanitized.replaceAll(encoded, '[redacted credential]');
    }
  }
  sanitized = sanitized
    .replace(/https?:\/\/[^\s"'<>]+/giu, '[redacted URL]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [redacted]')
    .replace(
      /\b(?:OPENAI_API_KEY|API[_-]?KEY|AUTHORIZATION|ACCESS[_-]?TOKEN|SECRET)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      'credential=[redacted]',
    )
    .replace(/\bsk-[\w-]{8,}\b/gu, '[redacted credential]');
  // Public model identifiers can be long; length alone does not make them secrets.
  return modelName
    ? sanitized
    : sanitized.replace(/\b[\w+/=-]{32,}\b/gu, '[redacted credential]');
}

export function sanitizeBenchReportValue(
  value: unknown,
  secrets: readonly string[] = [],
): unknown {
  const readScreenshot = createBenchScreenshotReader();
  return sanitize(value);

  function sanitize(value: unknown): unknown {
    if (typeof value === 'string') return redactString(value, secrets);
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item));
    }
    if (value === null || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        // Image bytes must bypass text/credential redaction, which corrupts Base64.
        if (key === 'screenshotDataUrl') {
          const screenshot = readScreenshot(item);
          return screenshot ? [[key, screenshot]] : [];
        }
        if (isSensitiveKey(key)) return [];
        if (key === 'model' && typeof item === 'string') {
          return [[key, redactString(item, secrets, true)]];
        }
        // UUID job handles are public report identities, not provider credentials.
        // Preserve only this exact field/format; never exempt arbitrary long strings.
        if (
          key === 'jobId' && typeof item === 'string' && BENCH_JOB_ID.test(item)
        ) {
          return [[key, item]];
        }
        return [[key, sanitize(item)]];
      }),
    );
  }
}

export function serializeBenchReport(
  report: BenchReport,
  secrets: readonly string[] = [],
): string {
  return JSON.stringify(sanitizeBenchReportValue(report, secrets), null, 2);
}
