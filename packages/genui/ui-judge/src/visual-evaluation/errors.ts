// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  VisualEvaluationErrorCode,
  VisualEvaluationErrorResponse,
} from './types.js';

export class VisualEvaluationError extends Error {
  constructor(
    readonly status: number,
    readonly code: VisualEvaluationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VisualEvaluationError';
  }
}

export function createVisualEvaluationError(
  status: number,
  code: VisualEvaluationErrorCode,
  message: string,
): VisualEvaluationError {
  return new VisualEvaluationError(status, code, message);
}

export function toVisualEvaluationErrorResponse(
  error: unknown,
): VisualEvaluationErrorResponse {
  if (error instanceof VisualEvaluationError) {
    return {
      code: error.code,
      message: error.message,
      ok: false,
      status: error.status,
    };
  }

  return {
    code: 'VISUAL_EVALUATION_ERROR',
    message: getErrorMessage(error),
    ok: false,
    status: 500,
  };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function rethrowAsVisualEvaluationError(
  error: unknown,
  status: number,
  code: VisualEvaluationErrorCode,
): never {
  if (error instanceof VisualEvaluationError) {
    throw error;
  }

  throw createVisualEvaluationError(status, code, getErrorMessage(error));
}
