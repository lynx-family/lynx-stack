// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const BENCH_SCREENSHOT_DATA_URL_PREFIX = 'data:image/png;base64,';
export const MAX_BENCH_SCREENSHOT_DECODED_BYTES = 2 * 1024 * 1024;
export const MAX_BENCH_JOB_SCREENSHOT_DECODED_BYTES = 8 * 1024 * 1024;

const MAX_BENCH_SCREENSHOT_ENCODED_CHARS = Math.ceil(
  MAX_BENCH_SCREENSHOT_DECODED_BYTES / 3,
) * 4;

export function benchScreenshotDecodedBytes(
  value: string,
): number | null {
  if (!value.startsWith(BENCH_SCREENSHOT_DATA_URL_PREFIX)) return null;
  const encoded = value.slice(BENCH_SCREENSHOT_DATA_URL_PREFIX.length);
  if (
    encoded.length === 0
    || encoded.length % 4 === 1
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  ) {
    return null;
  }
  let padding = 0;
  if (encoded.endsWith('==')) {
    padding = 2;
  } else if (encoded.endsWith('=')) {
    padding = 1;
  }
  return Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
}

export function readBenchScreenshotDataUrl(
  value: unknown,
): string | undefined {
  if (
    typeof value !== 'string'
    || !value.startsWith(BENCH_SCREENSHOT_DATA_URL_PREFIX)
  ) {
    return undefined;
  }
  const encodedLength = value.length - BENCH_SCREENSHOT_DATA_URL_PREFIX.length;
  const decodedBytes = benchScreenshotDecodedBytes(value);
  return decodedBytes !== null
      && decodedBytes <= MAX_BENCH_SCREENSHOT_DECODED_BYTES
      && encodedLength <= MAX_BENCH_SCREENSHOT_ENCODED_CHARS
    ? value
    : undefined;
}
