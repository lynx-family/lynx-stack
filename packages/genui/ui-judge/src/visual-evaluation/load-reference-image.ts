// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createVisualEvaluationError } from './errors.js';
import {
  decodeBase64Image,
  getHttpImageUrl,
  normalizeImageToPngBuffer,
} from './image-format.js';

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
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      `Failed to fetch reference image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    throw createVisualEvaluationError(
      502,
      'REFERENCE_IMAGE_FETCH_FAILED',
      `Failed to fetch reference image: ${response.status}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
