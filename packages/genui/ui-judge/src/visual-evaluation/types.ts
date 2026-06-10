// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface VisualEvaluationRequest {
  alignOptions?: VisualEvaluationAlignOptions;
  capture?: VisualEvaluationCaptureRequestOptions;
  compareOptions?: VisualEvaluationCompareOptions;
  referenceImage: string;
  templateUrl: string;
  traceId?: string;
}

export interface VisualEvaluationCaptureRequestOptions {
  maxRetry?: number;
  silent?: boolean;
  waitTimeMs?: number;
}

export interface VisualEvaluationAlignOptions {
  downsampleWidth?: number;
  maxDx?: number;
  maxDyRatio?: number;
  minScore?: number;
  targetWidth?: number;
  topSkipRatio?: number;
  windowHeightRatio?: number;
}

export interface VisualEvaluationCompareOptions {
  blockSize?: number;
  pixelTolerance?: number;
  threshold?: number;
}

export interface VisualEvaluationResponse {
  artifacts: VisualEvaluationArtifacts;
  metrics: VisualEvaluationMetrics;
  ok: true;
  reason?: string;
  score?: number;
  warnings?: string[];
}

export interface VisualEvaluationArtifacts {
  alignedDeviceImageBase64: string;
  alignedReferenceImageBase64: string;
  deviceImageBase64: string;
  diffImageBase64: string;
  referenceImageBase64: string;
}

export interface VisualEvaluationMetrics {
  alignResult: AlignResult | null;
  compareResult: CompareResult;
  evaluationResult: EvaluationResult;
}

export interface AlignResult {
  crop: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  dx: number;
  dy: number;
  resizedHeight1: number;
  resizedHeight2: number;
  resizedWidth: number;
  score: number;
}

export interface CompareResult {
  diffBlocksData: Array<{
    diffRatio: number;
    x: number;
    y: number;
  }>;
  differentBlocks: number;
  height: number;
  similarity: number;
  totalBlocks: number;
  width: number;
}

export interface EvaluationResult {
  issues?: Array<{
    category: string;
    description: string;
    severity: 'high' | 'low' | 'medium';
  }>;
  reason?: string;
  score?: number;
  summary?: string;
  [key: string]: unknown;
}

export interface CaptureOptions {
  maxRetry?: number;
  silent?: boolean;
  targetPageUrl: string;
  traceId?: string;
  waitTimeMs?: number;
}

export type CaptureFn = (
  options: CaptureOptions,
) => Promise<string | undefined>;

export type EvaluateFn = (
  image1DataUrl: string,
  image2DataUrl: string,
) => Promise<EvaluationResult | string | Record<string, unknown>>;

export type VisualEvaluationErrorCode =
  | 'CAPTURE_EMPTY_RESULT'
  | 'CAPTURE_UPSTREAM_ERROR'
  | 'EVALUATION_API_ERROR'
  | 'IMAGE_ALIGNMENT_ERROR'
  | 'IMAGE_COMPARE_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'REFERENCE_IMAGE_FETCH_FAILED'
  | 'REFERENCE_IMAGE_INVALID'
  | 'REQUEST_TOO_LARGE'
  | 'VISUAL_EVALUATION_ERROR';

export interface VisualEvaluationErrorResponse {
  code: VisualEvaluationErrorCode;
  message: string;
  ok: false;
  status: number;
}

export interface RunVisualEvaluationOptions {
  capture?: CaptureFn;
  evaluate?: EvaluateFn;
  fetch?: typeof fetch;
}
