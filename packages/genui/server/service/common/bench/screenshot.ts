// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { PNG } from 'pngjs';

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

export async function readBenchScreenshotDataUrl(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value === 'string' && value.startsWith('data:image/bmp;base64,')) {
    const encoded = value.slice('data:image/bmp;base64,'.length);
    if (
      encoded.length > Math.ceil((10 * 1024 * 1024 + 1024) / 3) * 4
      || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
    ) return undefined;
    const converted = await convertCapturedBmp(Buffer.from(encoded, 'base64'));
    return await readBenchScreenshotDataUrl(converted);
  }
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

// Accept only the runner's top-down, 32-bit BITMAPV4HEADER layout. Bound the
// uncompressed input separately from the smaller PNG stored in Bench reports.
export async function convertCapturedBmp(
  bmp: Buffer,
): Promise<string | undefined> {
  const maxPixelBytes = 10 * 1024 * 1024;
  const maxBmpBytes = maxPixelBytes + 1024;
  if (
    bmp.length < 122 || bmp.length > maxBmpBytes
    || bmp.toString('ascii', 0, 2) !== 'BM'
    || bmp.readUInt32LE(2) !== bmp.length
    || bmp.readUInt32LE(10) !== 122
    || bmp.readUInt32LE(14) !== 108
    || bmp.readUInt16LE(26) !== 1
    || bmp.readUInt16LE(28) !== 32
    || bmp.readUInt32LE(30) !== 3
    || bmp.readUInt32LE(54) !== 0x00ff0000
    || bmp.readUInt32LE(58) !== 0x0000ff00
    || bmp.readUInt32LE(62) !== 0x000000ff
    || bmp.readUInt32LE(66) !== 0xff000000
  ) return undefined;

  const width = bmp.readInt32LE(18);
  const height = -bmp.readInt32LE(22);
  const pixelBytes = width * height * 4;
  if (
    width <= 0 || height <= 0 || width > 8192 || height > 8192
    || pixelBytes > maxPixelBytes || 122 + pixelBytes !== bmp.length
  ) return undefined;

  const png = new PNG({ width, height });
  for (let offset = 0; offset < pixelBytes; offset += 4) {
    png.data[offset] = bmp[122 + offset + 2]!;
    png.data[offset + 1] = bmp[122 + offset + 1]!;
    png.data[offset + 2] = bmp[122 + offset]!;
    png.data[offset + 3] = bmp[122 + offset + 3]!;
  }

  // Model inputs retain all captured pixels. Report storage has a separate limit.
  const maxPngBytes = maxPixelBytes + 64 * 1024;
  const output = await new Promise<Buffer | undefined>((resolve) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    png.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxPngBytes) {
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    png.once('error', () => resolve(undefined));
    png.once('end', () => {
      resolve(
        bytes <= maxPngBytes
          ? Buffer.concat(chunks)
          : undefined,
      );
    });
    png.pack();
  });
  return output
    ? BENCH_SCREENSHOT_DATA_URL_PREFIX + output.toString('base64')
    : undefined;
}
