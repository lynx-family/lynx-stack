// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface VisualEvaluationRequest {
  alignOptions?: VisualEvaluationAlignOptions;
  compareOptions?: VisualEvaluationCompareOptions;
  referenceImage: string;
  renderedImage: string;
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
  alignedRenderedImageBase64: string;
  alignedReferenceImageBase64: string;
  diffImageBase64: string;
  referenceImageBase64: string;
  renderedImageBase64: string;
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
  issues?: EvaluationIssue[];
  reason?: string;
  score?: number;
  summary?: string;
  [key: string]: unknown;
}

export interface EvaluationIssue {
  category: EvaluationIssueCategory;
  description: string;
  severity: EvaluationIssueSeverity;
}

export type EvaluationIssueCategory =
  | 'asset'
  | 'color'
  | 'completeness'
  | 'layout'
  | 'other'
  | 'spacing'
  | 'state'
  | 'typography';

export type EvaluationIssueSeverity = 'high' | 'low' | 'medium';

export type EvaluateFn = (
  image1DataUrl: string,
  image2DataUrl: string,
  options?: VisualEvaluationAgentOptions,
) => Promise<EvaluationResult | string | Record<string, unknown>>;

export type VisualEvaluationErrorCode =
  | 'EVALUATION_API_ERROR'
  | 'IMAGE_ALIGNMENT_ERROR'
  | 'IMAGE_COMPARE_ERROR'
  | 'INVALID_REQUEST'
  | 'REFERENCE_IMAGE_FETCH_FAILED'
  | 'REFERENCE_IMAGE_INVALID'
  | 'RENDERED_IMAGE_FETCH_FAILED'
  | 'RENDERED_IMAGE_INVALID'
  | 'VISUAL_EVALUATION_ERROR';

export interface VisualEvaluationErrorResponse {
  code: VisualEvaluationErrorCode;
  message: string;
  ok: false;
  status: number;
}

export interface RunVisualEvaluationOptions {
  agent?: VisualEvaluationAgentOptions;
  evaluate?: EvaluateFn;
  fetch?: typeof fetch;
}

export interface VisualEvaluationAgentOptions {
  agent?: VisualEvaluationAgent;
  api?: 'chat' | 'responses';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  resourceId?: string;
}

export interface VisualEvaluationAgent {
  generate(
    messages: unknown,
    options?: { resourceId?: string },
  ): Promise<unknown> | unknown;
}
