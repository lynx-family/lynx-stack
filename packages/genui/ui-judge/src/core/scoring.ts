// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NormalizedJudgeOptions, UiJudgeScore } from '../types.js';
import { buildJudgePrompt } from './prompt.js';

const MIN_SCORE = 0;
const MAX_SCORE = 5;

export interface MidsceneJudgeAgent {
  aiAct(
    step: string,
    options?: { abortSignal?: AbortSignal },
  ): Promise<unknown>;
  aiNumber(
    prompt: string,
    options?: MidsceneJudgeQueryOptions,
  ): Promise<number>;
}

export interface MidsceneJudgeQueryOptions {
  domIncluded?: boolean | 'visible-only';
  screenshotIncluded?: boolean;
}

export async function judgeWithAgentUnsafe(
  agent: MidsceneJudgeAgent,
  options: NormalizedJudgeOptions,
  settings: { scoreOptions: MidsceneJudgeQueryOptions },
): Promise<UiJudgeScore> {
  for (const step of options.steps) {
    const abortController = new AbortController();
    await withAbortableTimeout(
      agent.aiAct(step, { abortSignal: abortController.signal }),
      options.timeoutMs,
      abortController,
      `Timed out while running Midscene step: ${step}`,
    );
  }

  const rawScore = await withTimeout(
    agent.aiNumber(buildJudgePrompt(options), settings.scoreOptions),
    options.timeoutMs,
    'Timed out while asking Midscene for a numeric score.',
  );

  return normalizeScore(rawScore);
}

function normalizeScore(value: number): UiJudgeScore {
  if (!Number.isFinite(value)) {
    throw new Error(`Midscene returned a non-finite score: ${String(value)}.`);
  }

  const rounded = Math.round(value);
  const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, rounded));
  return clamped as UiJudgeScore;
}

async function withAbortableTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController,
  message: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
