// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  JudgePageOptions,
  NormalizedJudgeOptions,
  NormalizedJudgePageOptions,
  UiJudgeDimension,
} from '../types.js';
import {
  DEFAULT_DIMENSION,
  getDimensionNames,
  isKnownDimension,
} from './dimensions.js';

const DEFAULT_TIMEOUT_MS = 60_000;

export function normalizeJudgePageOptions(
  options: JudgePageOptions,
): NormalizedJudgePageOptions {
  if (!options?.page) {
    throw new Error('judgePage requires a Playwright page.');
  }

  return {
    ...normalizeJudgeBaseOptions(options, 'judgePage'),
    page: options.page,
  };
}

export function normalizeJudgeBaseOptions(
  options: {
    dimension?: UiJudgeDimension;
    reference?: string;
    steps?: string[];
    task: string;
    timeoutMs?: number;
  },
  apiName: string,
): NormalizedJudgeOptions {
  const task = typeof options.task === 'string' ? options.task.trim() : '';
  if (!task) {
    throw new Error(`${apiName} requires a non-empty task.`);
  }

  const normalized: NormalizedJudgeOptions = {
    dimension: normalizeDimension(options.dimension, apiName),
    steps: normalizeSteps(options.steps),
    task,
    timeoutMs: normalizeTimeout(options.timeoutMs, apiName),
  };

  const reference = options.reference?.trim();
  if (reference) {
    normalized.reference = reference;
  }

  return normalized;
}

export function normalizeSteps(steps: string[] | undefined): string[] {
  return (steps ?? [])
    .filter((step): step is string => typeof step === 'string')
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

function normalizeDimension(
  dimension: UiJudgeDimension | undefined,
  apiName = 'judgePage',
): UiJudgeDimension {
  if (dimension === undefined) return DEFAULT_DIMENSION;
  if (isKnownDimension(dimension)) return dimension;

  throw new Error(
    `${apiName} dimension must be one of: ${getDimensionNames().join(', ')}.`,
  );
}

function normalizeTimeout(
  timeoutMs: number | undefined,
  apiName = 'judgePage',
): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`${apiName} timeoutMs must be a positive finite number.`);
  }
  return timeoutMs;
}
