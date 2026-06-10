// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createVisualEvaluationError } from './errors.js';
import type {
  VisualEvaluationAlignOptions,
  VisualEvaluationCaptureRequestOptions,
  VisualEvaluationCompareOptions,
  VisualEvaluationRequest,
} from './types.js';

export function validateVisualEvaluationRequest(
  body: unknown,
): VisualEvaluationRequest {
  if (!isRecord(body)) {
    throw createVisualEvaluationError(
      400,
      'INVALID_REQUEST',
      'Request body must be a JSON object.',
    );
  }

  const referenceImage = normalizeRequiredString(
    body['referenceImage'],
    'referenceImage',
  );
  const templateUrl = normalizeRequiredString(body['templateUrl'], 'templateUrl');

  const request: VisualEvaluationRequest = {
    referenceImage,
    templateUrl,
  };

  const traceId = normalizeOptionalString(body['traceId'], 'traceId');
  if (traceId !== undefined) {
    request.traceId = traceId;
  }

  if (body['capture'] !== undefined) {
    request.capture = validateCaptureOptions(body['capture']);
  }

  if (body['alignOptions'] !== undefined) {
    request.alignOptions = validateAlignOptions(body['alignOptions']);
  }

  if (body['compareOptions'] !== undefined) {
    request.compareOptions = validateCompareOptions(body['compareOptions']);
  }

  return request;
}

function validateCaptureOptions(
  value: unknown,
): VisualEvaluationCaptureRequestOptions {
  const options = normalizeOptionsObject(value, 'capture');
  const capture: VisualEvaluationCaptureRequestOptions = {};

  if (options['maxRetry'] !== undefined) {
    capture.maxRetry = normalizeFiniteNumber(
      options['maxRetry'],
      'capture.maxRetry',
      (number) => number > 0,
      'greater than 0',
    );
  }

  if (options['waitTimeMs'] !== undefined) {
    capture.waitTimeMs = normalizeFiniteNumber(
      options['waitTimeMs'],
      'capture.waitTimeMs',
      (number) => number >= 0,
      'greater than or equal to 0',
    );
  }

  if (options['silent'] !== undefined) {
    if (typeof options['silent'] !== 'boolean') {
      throw invalidRequest('capture.silent must be a boolean.');
    }
    capture.silent = options['silent'];
  }

  return capture;
}

function validateAlignOptions(value: unknown): VisualEvaluationAlignOptions {
  const options = normalizeOptionsObject(value, 'alignOptions');
  const alignOptions: VisualEvaluationAlignOptions = {};

  setPositiveNumberOption(
    alignOptions,
    options,
    'targetWidth',
    'alignOptions.targetWidth',
  );
  setPositiveNumberOption(
    alignOptions,
    options,
    'downsampleWidth',
    'alignOptions.downsampleWidth',
  );
  setRatioOption(
    alignOptions,
    options,
    'topSkipRatio',
    'alignOptions.topSkipRatio',
  );
  setRatioOption(
    alignOptions,
    options,
    'windowHeightRatio',
    'alignOptions.windowHeightRatio',
  );
  setRatioOption(
    alignOptions,
    options,
    'maxDyRatio',
    'alignOptions.maxDyRatio',
  );
  setNonNegativeNumberOption(
    alignOptions,
    options,
    'maxDx',
    'alignOptions.maxDx',
  );
  setNonNegativeNumberOption(
    alignOptions,
    options,
    'minScore',
    'alignOptions.minScore',
  );

  return alignOptions;
}

function validateCompareOptions(value: unknown): VisualEvaluationCompareOptions {
  const options = normalizeOptionsObject(value, 'compareOptions');
  const compareOptions: VisualEvaluationCompareOptions = {};

  setPositiveNumberOption(
    compareOptions,
    options,
    'blockSize',
    'compareOptions.blockSize',
  );
  setNonNegativeNumberOption(
    compareOptions,
    options,
    'threshold',
    'compareOptions.threshold',
  );
  setNonNegativeNumberOption(
    compareOptions,
    options,
    'pixelTolerance',
    'compareOptions.pixelTolerance',
  );

  return compareOptions;
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  const normalized = normalizeOptionalString(value, fieldName);
  if (normalized === undefined) {
    throw invalidRequest(`${fieldName} must be a non-empty string.`);
  }
  return normalized;
}

function normalizeOptionalString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw invalidRequest(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionsObject(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidRequest(`${fieldName} must be an object.`);
  }
  return value;
}

function setPositiveNumberOption<
  TOptions extends object,
  TKey extends keyof TOptions & string,
>(
  target: TOptions,
  source: Record<string, unknown>,
  key: TKey,
  fieldName: string,
): void {
  if (source[key] === undefined) return;
  target[key] = normalizeFiniteNumber(
    source[key],
    fieldName,
    (number) => number > 0,
    'greater than 0',
  ) as TOptions[TKey];
}

function setNonNegativeNumberOption<
  TOptions extends object,
  TKey extends keyof TOptions & string,
>(
  target: TOptions,
  source: Record<string, unknown>,
  key: TKey,
  fieldName: string,
): void {
  if (source[key] === undefined) return;
  target[key] = normalizeFiniteNumber(
    source[key],
    fieldName,
    (number) => number >= 0,
    'greater than or equal to 0',
  ) as TOptions[TKey];
}

function setRatioOption<
  TOptions extends object,
  TKey extends keyof TOptions & string,
>(
  target: TOptions,
  source: Record<string, unknown>,
  key: TKey,
  fieldName: string,
): void {
  if (source[key] === undefined) return;
  target[key] = normalizeFiniteNumber(
    source[key],
    fieldName,
    (number) => number >= 0 && number <= 1,
    'between 0 and 1',
  ) as TOptions[TKey];
}

function normalizeFiniteNumber(
  value: unknown,
  fieldName: string,
  validate: (number: number) => boolean,
  expected: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidRequest(`${fieldName} must be a finite number.`);
  }

  if (!validate(value)) {
    throw invalidRequest(`${fieldName} must be ${expected}.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidRequest(message: string): never {
  throw createVisualEvaluationError(400, 'INVALID_REQUEST', message);
}
