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
  return await loadImage(referenceImage, fetchImpl, {
    fetchFailedCode: 'REFERENCE_IMAGE_FETCH_FAILED',
    fetchFailedPrefix: 'reference image',
    invalidCode: 'REFERENCE_IMAGE_INVALID',
    invalidMessage: 'Reference image is empty, malformed, or unreadable.',
  });
}

export async function loadRenderedImage(
  renderedImage: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  return await loadImage(renderedImage, fetchImpl, {
    fetchFailedCode: 'RENDERED_IMAGE_FETCH_FAILED',
    fetchFailedPrefix: 'rendered image',
    invalidCode: 'RENDERED_IMAGE_INVALID',
    invalidMessage: 'Rendered image is empty, malformed, or unreadable.',
  });
}

async function loadImage(
  image: string,
  fetchImpl: typeof fetch,
  options: {
    fetchFailedCode:
      | 'REFERENCE_IMAGE_FETCH_FAILED'
      | 'RENDERED_IMAGE_FETCH_FAILED';
    fetchFailedPrefix: string;
    invalidCode: 'REFERENCE_IMAGE_INVALID' | 'RENDERED_IMAGE_INVALID';
    invalidMessage: string;
  },
): Promise<Buffer> {
  const url = getHttpImageUrl(image);
  const buffer = url
    ? await fetchImage(url, fetchImpl, options)
    : decodeBase64Image(
      image,
      options.invalidCode,
      options.invalidMessage,
    );

  return await normalizeImageToPngBuffer(
    buffer,
    400,
    options.invalidCode,
    options.invalidMessage,
  );
}

async function fetchImage(
  url: URL,
  fetchImpl: typeof fetch,
  options: {
    fetchFailedCode:
      | 'REFERENCE_IMAGE_FETCH_FAILED'
      | 'RENDERED_IMAGE_FETCH_FAILED';
    fetchFailedPrefix: string;
  },
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
    validateImageResponse(response, options);
    return await readImageResponse(response, options.fetchFailedCode);
  } catch (error) {
    if (error instanceof VisualEvaluationError) {
      throw error;
    }
    throw createVisualEvaluationError(
      502,
      options.fetchFailedCode,
      `Failed to fetch ${options.fetchFailedPrefix}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function validateImageResponse(
  response: Response,
  options: {
    fetchFailedCode:
      | 'REFERENCE_IMAGE_FETCH_FAILED'
      | 'RENDERED_IMAGE_FETCH_FAILED';
    fetchFailedPrefix: string;
  },
): void {
  if (!response.ok) {
    throw createVisualEvaluationError(
      502,
      options.fetchFailedCode,
      `Failed to fetch ${options.fetchFailedPrefix}: ${response.status}`,
    );
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw createVisualEvaluationError(
      502,
      options.fetchFailedCode,
      `${
        capitalize(options.fetchFailedPrefix)
      } response must be an image, got ${contentType}.`,
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
        options.fetchFailedCode,
        `${capitalize(options.fetchFailedPrefix)} response is too large.`,
      );
    }
  }
}

async function readImageResponse(
  response: Response,
  errorCode: 'REFERENCE_IMAGE_FETCH_FAILED' | 'RENDERED_IMAGE_FETCH_FAILED',
): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    assertImageSize(buffer.length, errorCode);
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
    assertImageSize(totalBytes, errorCode);
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
}

function assertImageSize(
  totalBytes: number,
  errorCode: 'REFERENCE_IMAGE_FETCH_FAILED' | 'RENDERED_IMAGE_FETCH_FAILED',
): void {
  if (totalBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw createVisualEvaluationError(
      502,
      errorCode,
      'Image response is too large.',
    );
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
