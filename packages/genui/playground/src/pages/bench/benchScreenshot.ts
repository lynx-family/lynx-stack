// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const PNG_PREFIX = 'data:image/png;base64,';
export const MAX_BENCH_SCREENSHOT_BYTES = 2 * 1024 * 1024;
export const MAX_BENCH_REPORT_SCREENSHOT_BYTES = 8 * 1024 * 1024;

/** Accept bounded, self-contained PNGs, never remote, SVG, or browser-local URLs. */
export function readBenchScreenshotDataUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith(PNG_PREFIX)) return;
  const encoded = value.slice(PNG_PREFIX.length);
  if (
    encoded.length > Math.ceil(MAX_BENCH_SCREENSHOT_BYTES / 3) * 4
    || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  ) return;

  let bytes: string;
  try {
    bytes = atob(encoded);
  } catch {
    return;
  }
  if (
    bytes.length > MAX_BENCH_SCREENSHOT_BYTES
    || !bytes.startsWith('\u0089PNG\r\n\u001a\n')
    || bytes.slice(12, 16) !== 'IHDR'
  ) return;
  const uint32 = (offset: number) =>
    ((bytes.charCodeAt(offset) << 24) | (bytes.charCodeAt(offset + 1) << 16)
      | (bytes.charCodeAt(offset + 2) << 8) | bytes.charCodeAt(offset + 3))
    >>> 0;
  const width = uint32(16);
  const height = uint32(20);
  if (
    uint32(8) !== 13 || !width || !height || width > 8192 || height > 8192
    || width * height * 4 > 10 * 1024 * 1024
  ) return;

  let hasPixels = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = uint32(offset);
    const type = bytes.slice(offset + 4, offset + 8);
    const next = offset + length + 12;
    if (next > bytes.length || (type === 'IHDR' && offset !== 8)) return;
    if (type === 'IDAT' && length > 0) hasPixels = true;
    if (type === 'IEND') {
      return length === 0 && next === bytes.length && hasPixels
        ? value
        : undefined;
    }
    offset = next;
  }
  return;
}

/** Share the same aggregate image budget across every result in one report. */
export function createBenchScreenshotReader() {
  let remaining = MAX_BENCH_REPORT_SCREENSHOT_BYTES;
  return (value: unknown): string | undefined => {
    const screenshot = readBenchScreenshotDataUrl(value);
    if (!screenshot) return;
    const padding = screenshot.endsWith('==')
      ? 2
      : (screenshot.endsWith('=') ? 1 : 0);
    const bytes = (screenshot.length - PNG_PREFIX.length) / 4 * 3 - padding;
    if (bytes > remaining) return;
    remaining -= bytes;
    return screenshot;
  };
}
