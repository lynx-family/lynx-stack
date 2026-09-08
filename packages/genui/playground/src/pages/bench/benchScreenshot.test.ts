// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { sanitizeBenchReportValue } from './benchReportSerialization.js';
import {
  MAX_BENCH_SCREENSHOT_BYTES,
  createBenchScreenshotReader,
  readBenchScreenshotDataUrl,
} from './benchScreenshot.js';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

function imageBytes(): Buffer {
  return Buffer.from(PNG.split(',')[1]!, 'base64');
}

function dataUrl(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

describe('Bench screenshot boundary', () => {
  test('preserves PNG bytes exactly while redacting credentials elsewhere', () => {
    const report = {
      apiKey: 'private-key',
      results: [{ screenshotDataUrl: PNG, error: 'Bearer private-key' }],
    };
    const original = JSON.stringify(report);
    const sanitized = sanitizeBenchReportValue(report);
    expect(sanitized).toEqual({
      results: [{ screenshotDataUrl: PNG, error: 'Bearer [redacted]' }],
    });
    expect(sanitizeBenchReportValue(sanitized)).toEqual(sanitized);
    expect(JSON.stringify(report)).toBe(original);
  });

  test.each([
    undefined,
    null,
    'https://tracker.example.test/image.png',
    'file:///tmp/image.png',
    'blob:https://example.test/image',
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    'data:image/png;base64,PHN2Zy8+',
    'data:image/png;base64,invalid!',
    PNG.slice(0, -8),
    dataUrl(Buffer.concat([imageBytes(), Buffer.from('trailing bytes')])),
  ])('drops unsafe or malformed images: %#', (value) => {
    expect(readBenchScreenshotDataUrl(value)).toBeUndefined();
    expect(sanitizeBenchReportValue({ screenshotDataUrl: value })).toEqual({});
  });

  test('bounds image bytes and decoded dimensions before rendering', () => {
    expect(readBenchScreenshotDataUrl(
      dataUrl(Buffer.alloc(MAX_BENCH_SCREENSHOT_BYTES + 1)),
    )).toBeUndefined();
    const wide = imageBytes();
    wide.writeUInt32BE(9000, 16);
    expect(readBenchScreenshotDataUrl(dataUrl(wide))).toBeUndefined();
    const tooManyPixels = imageBytes();
    tooManyPixels.writeUInt32BE(8192, 16);
    tooManyPixels.writeUInt32BE(8192, 20);
    expect(readBenchScreenshotDataUrl(dataUrl(tooManyPixels))).toBeUndefined();
    const invalidChunk = imageBytes();
    invalidChunk.writeUInt32BE(0xffffffff, 33);
    expect(readBenchScreenshotDataUrl(dataUrl(invalidChunk))).toBeUndefined();
  });

  test('bounds aggregate PNG bytes across a report', () => {
    // A padded PNG envelope exercises the byte budget, not pixel decoding.
    const original = imageBytes();
    const chunk = Buffer.alloc(MAX_BENCH_SCREENSHOT_BYTES - original.length);
    chunk.writeUInt32BE(chunk.length - 12);
    chunk.write('tEXt', 4);
    const large = dataUrl(Buffer.concat([
      original.subarray(0, -12),
      chunk,
      original.subarray(-12),
    ]));
    const read = createBenchScreenshotReader();
    for (let index = 0; index < 4; index++) expect(read(large)).toBe(large);
    expect(read(PNG)).toBeUndefined();
    const result = sanitizeBenchReportValue({
      results: Array.from({ length: 5 }, () => ({ screenshotDataUrl: large })),
    }) as { results: { screenshotDataUrl?: string }[] };
    expect(result.results.filter((run) => run.screenshotDataUrl)).toHaveLength(
      4,
    );
  });
});
