// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';

import { alignImages } from './align-images.js';
import { compareImages } from './compare-images.js';
import { defaultCapture } from './capture.js';
import {
  createVisualEvaluationError,
  rethrowAsVisualEvaluationError,
} from './errors.js';
import {
  evaluateImagesWithMidscene,
  normalizeEvaluationResult,
} from './evaluation-api.js';
import {
  bufferToImageDataUrl,
  decodeBase64Image,
  normalizeImageToPngBuffer,
} from './image-format.js';
import { loadReferenceImage } from './load-reference-image.js';
import type {
  AlignResult,
  CaptureOptions,
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
  const referenceBuffer = await loadReferenceImage(
    request.referenceImage,
    options.fetch ?? fetch,
  );

  const capture = options.capture ?? defaultCapture;
  let deviceImageBase64: string | undefined;
  try {
    const captureOptions: CaptureOptions = {
      targetPageUrl: request.templateUrl,
    };
    if (request.capture?.maxRetry !== undefined) {
      captureOptions.maxRetry = request.capture.maxRetry;
    }
    if (request.capture?.silent !== undefined) {
      captureOptions.silent = request.capture.silent;
    }
    if (request.traceId !== undefined) {
      captureOptions.traceId = request.traceId;
    }
    if (request.capture?.waitTimeMs !== undefined) {
      captureOptions.waitTimeMs = request.capture.waitTimeMs;
    }
    deviceImageBase64 = await capture(captureOptions);
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 502, 'CAPTURE_UPSTREAM_ERROR');
  }

  if (!deviceImageBase64) {
    throw createVisualEvaluationError(
      502,
      'CAPTURE_EMPTY_RESULT',
      'Capture returned no image data.',
    );
  }

  const deviceBuffer = await normalizeCapturedImage(deviceImageBase64);
  const workspace = await createVisualEvaluationWorkspace();

  try {
    await writeInputImages(workspace, referenceBuffer, deviceBuffer);

    const alignment = await runAlignment(workspace, request, warnings);
    const compareResult = await runCompare(
      alignment.referencePath,
      alignment.devicePath,
      workspace.diffPath,
      request,
    );
    const [
      alignedReferenceBuffer,
      alignedDeviceBuffer,
      diffBuffer,
    ] = await Promise.all([
      readFile(alignment.referencePath),
      readFile(alignment.devicePath),
      readFile(workspace.diffPath),
    ]);
    const evaluationResult = await runEvaluation(
      alignedReferenceBuffer,
      alignedDeviceBuffer,
      options,
    );

    return buildResponse({
      alignResult: alignment.result,
      alignedDeviceBuffer,
      alignedReferenceBuffer,
      compareResult,
      deviceBuffer,
      diffBuffer,
      evaluationResult,
      referenceBuffer,
      warnings,
    });
  } finally {
    await removeVisualEvaluationWorkspace(workspace);
  }
}

async function normalizeCapturedImage(deviceImageBase64: string): Promise<Buffer> {
  const buffer = decodeBase64Image(
    deviceImageBase64,
    'CAPTURE_EMPTY_RESULT',
    'Capture returned malformed image data.',
  );
  return await normalizeImageToPngBuffer(
    buffer,
    502,
    'CAPTURE_EMPTY_RESULT',
    'Capture returned malformed image data.',
  );
}

async function runAlignment(
  workspace: Awaited<ReturnType<typeof createVisualEvaluationWorkspace>>,
  request: VisualEvaluationRequest,
  warnings: string[],
): Promise<{
  devicePath: string;
  referencePath: string;
  result: AlignResult | null;
}> {
  let alignResult: AlignResult | null;
  try {
    alignResult = await alignImages(workspace.referencePath, workspace.devicePath, {
      ...request.alignOptions,
      outputAlignedDevicePath: workspace.alignedDevicePath,
      outputAlignedReferencePath: workspace.alignedReferencePath,
    });
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 500, 'IMAGE_ALIGNMENT_ERROR');
  }

  if (!alignResult) {
    warnings.push('Image alignment confidence too low; compared original images.');
    return {
      devicePath: workspace.devicePath,
      referencePath: workspace.referencePath,
      result: null,
    };
  }

  return {
    devicePath: workspace.alignedDevicePath,
    referencePath: workspace.alignedReferencePath,
    result: alignResult,
  };
}

async function runCompare(
  referencePath: string,
  devicePath: string,
  diffPath: string,
  request: VisualEvaluationRequest,
): Promise<CompareResult> {
  try {
    return await compareImages(referencePath, devicePath, {
      ...request.compareOptions,
      outputPath: diffPath,
    });
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 500, 'IMAGE_COMPARE_ERROR');
  }
}

async function runEvaluation(
  alignedReferenceBuffer: Buffer,
  alignedDeviceBuffer: Buffer,
  options: RunVisualEvaluationOptions,
): Promise<EvaluationResult> {
  const evaluate = options.evaluate ?? evaluateImagesWithMidscene;
  try {
    const rawResult = await evaluate(
      bufferToImageDataUrl(alignedReferenceBuffer),
      bufferToImageDataUrl(alignedDeviceBuffer),
    );
    return normalizeEvaluationResult(rawResult);
  } catch (error) {
    rethrowAsVisualEvaluationError(error, 502, 'EVALUATION_API_ERROR');
  }
}

function buildResponse(options: {
  alignResult: AlignResult | null;
  alignedDeviceBuffer: Buffer;
  alignedReferenceBuffer: Buffer;
  compareResult: CompareResult;
  deviceBuffer: Buffer;
  diffBuffer: Buffer;
  evaluationResult: EvaluationResult;
  referenceBuffer: Buffer;
  warnings: string[];
}): VisualEvaluationResponse {
  const response: VisualEvaluationResponse = {
    artifacts: {
      alignedDeviceImageBase64: options.alignedDeviceBuffer.toString('base64'),
      alignedReferenceImageBase64: options.alignedReferenceBuffer.toString(
        'base64',
      ),
      deviceImageBase64: options.deviceBuffer.toString('base64'),
      diffImageBase64: options.diffBuffer.toString('base64'),
      referenceImageBase64: options.referenceBuffer.toString('base64'),
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
