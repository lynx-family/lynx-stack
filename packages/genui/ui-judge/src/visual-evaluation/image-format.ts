// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';

import { createVisualEvaluationError } from './errors.js';
import type { VisualEvaluationErrorCode } from './types.js';

export type ImageExtension = 'jpg' | 'png' | 'unknown';

const BASE64_PREFIX = 'base64,';

export function stripDataUrlPrefix(value: string): string {
  const idx = value.indexOf(BASE64_PREFIX);
  return idx === -1 ? value : value.slice(idx + BASE64_PREFIX.length);
}

export function decodeBase64Image(
  value: string,
  code: VisualEvaluationErrorCode,
  message: string,
): Buffer {
  const rawBase64 = stripDataUrlPrefix(value).replace(/\s/g, '');
  if (!rawBase64 || rawBase64.length % 4 === 1) {
    throw createVisualEvaluationError(400, code, message);
  }

  if (!/^[\d+/=A-Za-z]+$/.test(rawBase64) || !/^.+={0,2}$/.test(rawBase64)) {
    throw createVisualEvaluationError(400, code, message);
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length === 0) {
    throw createVisualEvaluationError(400, code, message);
  }

  return buffer;
}

export function sniffImageExt(buffer: Buffer): ImageExtension {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return 'png';
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpg';
  }

  return 'unknown';
}

export function bufferToImageDataUrl(buffer: Buffer): string {
  const mimeType = sniffImageExt(buffer) === 'jpg'
    ? 'image/jpeg'
    : 'image/png';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function normalizeImageToPngBuffer(
  buffer: Buffer,
  status: number,
  code: VisualEvaluationErrorCode,
  message: string,
): Promise<Buffer> {
  if (buffer.length === 0) {
    throw createVisualEvaluationError(status, code, message);
  }

  try {
    return await sharp(buffer, { failOn: 'none' }).png().toBuffer();
  } catch {
    throw createVisualEvaluationError(status, code, message);
  }
}

export function getHttpImageUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}
