// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';

import { alignImages } from './align-images.js';
import { compareImages } from './compare-images.js';
import { rethrowAsVisualEvaluationError } from './errors.js';
import {
  evaluateImagesWithAgent,
  normalizeEvaluationResult,
} from './evaluation-api.js';
import { bufferToImageDataUrl } from './image-format.js';
import {
  loadReferenceImage,
  loadRenderedImage,
} from './load-reference-image.js';
import type {
  AlignResult,
  CompareResult,
  EvaluationResult,
  RunVisualEvaluationOptions,
  VisualEvaluationRequest,
  VisualEvaluationResponse,
} from './types.js';
import { validateVisualEvaluationRequest } from './validation.js';
import {
  createVisualEvaluationWorkspace,
  removeVisualEvaluationWorkspace,
  writeInputImages,
} from './workspace.js';

export async function runVisualEvaluation(
  body: VisualEvaluationRequest,
  options: RunVisualEvaluationOptions = {},
): Promise<VisualEvaluationResponse> {
  const request = validateVisualEvaluationRequest(body);
  const warnings: string[] = [];
  const fetchImpl = options.fetch ?? fetch;
  const [referenceBuffer, renderedBuffer] = await Promise.all([
    loadReferenceImage(request.referenceImage, fetchImpl),
    loadRenderedImage(request.renderedImage, fetchImpl),
  ]);
  const workspace = await createVisualEvaluationWorkspace();

  try {
    await writeInputImages(workspace, referenceBuffer, renderedBuffer);

    const alignment = await runAlignment(workspace, request, warnings);
    const compareResult = await runCompare(
      alignment.referencePath,
      alignment.renderedPath,
      workspace.diffPath,
      request,
    );
    const [
      alignedReferenceBuffer,
      alignedRenderedBuffer,
      diffBuffer,
    ] = await Promise.all([
      readFile(alignment.referencePath),
      readFile(alignment.renderedPath),
      readFile(workspace.diffPath),
    ]);
    const evaluationResult = await runEvaluation(
      alignedReferenceBuffer,
      alignedRenderedBuffer,
      options,
    );

    return buildResponse({
      alignResult: alignment.result,
      alignedReferenceBuffer,
      alignedRenderedBuffer,
      compareResult,
      diffBuffer,
      evaluationResult,
      referenceBuffer,
      renderedBuffer,
      warnings,
    });
  } finally {
    await removeVisualEvaluationWorkspace(workspace);
  }
}

async function runAlignment(
  workspace: Awaited<ReturnType<typeof createVisualEvaluationWorkspace>>,
  request: VisualEvaluationRequest,
  warnings: string[],
): Promise<{
  referencePath: string;
  renderedPath: string;
  result: AlignResult | null;
}> {
  let alignResult: AlignResult | null;
  try {
    alignResult = await alignImages(
      workspace.referencePath,
      workspace.renderedPath,
      {
        ...request.alignOptions,
        outputAlignedReferencePath: workspace.alignedReferencePath,
        outputAlignedRenderedPath: workspace.alignedRenderedPath,
      },
    );
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 500, 'IMAGE_ALIGNMENT_ERROR');
  }

  if (!alignResult) {
    warnings.push(
      'Image alignment confidence too low; compared original images.',
    );
    return {
      referencePath: workspace.referencePath,
      renderedPath: workspace.renderedPath,
      result: null,
    };
  }

  return {
    referencePath: workspace.alignedReferencePath,
    renderedPath: workspace.alignedRenderedPath,
    result: alignResult,
  };
}

async function runCompare(
  referencePath: string,
  renderedPath: string,
  diffPath: string,
  request: VisualEvaluationRequest,
): Promise<CompareResult> {
  try {
    return await compareImages(referencePath, renderedPath, {
      ...request.compareOptions,
      outputPath: diffPath,
    });
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 500, 'IMAGE_COMPARE_ERROR');
  }
}

async function runEvaluation(
  alignedReferenceBuffer: Buffer,
  alignedRenderedBuffer: Buffer,
  options: RunVisualEvaluationOptions,
): Promise<EvaluationResult> {
  const evaluate = options.evaluate ?? evaluateImagesWithAgent;
  try {
    const rawResult = await evaluate(
      bufferToImageDataUrl(alignedReferenceBuffer),
      bufferToImageDataUrl(alignedRenderedBuffer),
      options.agent,
    );
    return normalizeEvaluationResult(rawResult);
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 502, 'EVALUATION_API_ERROR');
  }
}

function buildResponse(options: {
  alignResult: AlignResult | null;
  alignedReferenceBuffer: Buffer;
  alignedRenderedBuffer: Buffer;
  compareResult: CompareResult;
  diffBuffer: Buffer;
  evaluationResult: EvaluationResult;
  referenceBuffer: Buffer;
  renderedBuffer: Buffer;
  warnings: string[];
}): VisualEvaluationResponse {
  const response: VisualEvaluationResponse = {
    artifacts: {
      alignedReferenceImageBase64: options.alignedReferenceBuffer.toString(
        'base64',
      ),
      alignedRenderedImageBase64: options.alignedRenderedBuffer.toString(
        'base64',
      ),
      diffImageBase64: options.diffBuffer.toString('base64'),
      referenceImageBase64: options.referenceBuffer.toString('base64'),
      renderedImageBase64: options.renderedBuffer.toString('base64'),
    },
    metrics: {
      alignResult: options.alignResult,
      compareResult: options.compareResult,
      evaluationResult: options.evaluationResult,
    },
    ok: true,
  };

  if (typeof options.evaluationResult.score === 'number') {
    response.score = options.evaluationResult.score;
  }

  if (typeof options.evaluationResult.reason === 'string') {
    response.reason = options.evaluationResult.reason;
  }

  if (options.warnings.length > 0) {
    response.warnings = options.warnings;
  }

  return response;
}
