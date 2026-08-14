// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchProviderConfig } from './a2ui-bench-types';
import { redactModelConfigSecrets } from './common/model-config.js';

const PRIVATE_FIELD_NAMES = new Set([
  'apikey',
  'authorization',
  'baseurl',
]);
const DIAGNOSTIC_FIELD_NAMES = new Set([
  'error',
  'errors',
  'judgereason',
  'judgesummary',
  'judgewarnings',
  'reason',
  'summary',
  'warning',
  'warnings',
]);

function secretVariants(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set([value, encodeURIComponent(value)])]
    .sort((left, right) => right.length - left.length);
}

export function redactBenchText(
  value: string,
  provider: BenchProviderConfig,
): string {
  let redacted = value;
  for (
    const secret of [
      ...secretVariants(provider.apiKey),
      ...secretVariants(provider.baseURL),
    ]
  ) {
    redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  return redactModelConfigSecrets(redacted)
    .replace(/\bBearer\s+[^\s,;"']+/giu, 'Bearer [REDACTED]')
    .replace(
      /([?&](?:access_token|api[_-]?key|key|token)=)[^&#\s"'<>]*/giu,
      '$1[REDACTED]',
    );
}

export function redactBenchDiagnostic(
  value: string,
  provider: BenchProviderConfig,
): string {
  return redactBenchText(value, provider).replace(
    /https?:\/\/[^\s"'<>]+/giu,
    '[REDACTED_URL]',
  );
}

function sanitizeDiagnosticValue(
  value: unknown,
  provider: BenchProviderConfig,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') return redactBenchDiagnostic(value, provider);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item, provider, seen));
  }
  return sanitizeBenchPublicValue(value, provider, seen);
}

export function sanitizeBenchPublicValue(
  value: unknown,
  provider: BenchProviderConfig,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') return redactBenchText(value, provider);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeBenchPublicValue(item, provider, seen));
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const normalizedKey = key.replace(/[^a-z]/giu, '').toLowerCase();
      return PRIVATE_FIELD_NAMES.has(normalizedKey)
        ? []
        : [[
          key,
          DIAGNOSTIC_FIELD_NAMES.has(normalizedKey)
            ? sanitizeDiagnosticValue(item, provider, seen)
            : sanitizeBenchPublicValue(item, provider, seen),
        ]];
    }),
  );
}
