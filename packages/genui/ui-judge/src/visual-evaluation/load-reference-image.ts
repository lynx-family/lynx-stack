// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  VisualEvaluationError,
  createVisualEvaluationError,
} from './errors.js';
import {
  decodeBase64Image,
  getHttpImageUrl,
  normalizeImageToPngBuffer,
} from './image-format.js';

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const REFERENCE_IMAGE_FETCH_TIMEOUT_MS = 10_000;

export async function loadReferenceImage(
  referenceImage: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const url = getHttpImageUrl(referenceImage);
  const buffer = url
    ? await fetchReferenceImage(url, fetchImpl)
    : decodeBase64Image(
      referenceImage,
      'REFERENCE_IMAGE_INVALID',
      'Reference image is empty, malformed, or unreadable.',
    );

  return await normalizeImageToPngBuffer(
    buffer,
    400,
    'REFERENCE_IMAGE_INVALID',
    'Reference image is empty, malformed, or unreadable.',
  );
}

async function fetchReferenceImage(
  url: URL,
  fetchImpl: typeof fetch,
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REFERENCE_IMAGE_FETCH_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: 'error',
      signal: controller.signal,
    });
    validateReferenceImageResponse(response);
    return await readReferenceImageResponse(response);
  } catch (error) {
    if (error instanceof VisualEvaluationError) {
      throw error;
    }
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      `Failed to fetch reference image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function validateReferenceImageResponse(response: Response): void {
  if (!response.ok) {
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      `Failed to fetch reference image: ${response.status}`,
    );
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      `Reference image response must be an image, got ${contentType}.`,
    );
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isFinite(parsedLength)
      || parsedLength > MAX_REFERENCE_IMAGE_BYTES
    ) {
      throw createVisualEvaluationError(
        502,
        'REFERENCE_IMAGE_FETCH_FAILED',
        'Reference image response is too large.',
      );
    }
  }
}

async function readReferenceImageResponse(response: Response): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    assertReferenceImageSize(buffer.length);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;

    const chunk = Buffer.from(result.value);
    totalBytes += chunk.length;
    assertReferenceImageSize(totalBytes);
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
}

function assertReferenceImageSize(totalBytes: number): void {
  if (totalBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      'Reference image response is too large.',
    );
  }
}
