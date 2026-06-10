// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NormalizedJudgeOptions, UiJudgeScore } from '../types.js';
import { buildJudgePrompt } from './prompt.js';

const MIN_SCORE = 0;
const MAX_SCORE = 5;
const SCORE_NUMBER_OPTIONS: Omit<MidsceneJudgeNumberOptions, 'abortSignal'> = {
  domIncluded: false,
  screenshotIncluded: true,
};

export interface MidsceneJudgeAgent {
  aiAct(
    step: string,
    options?: MidsceneJudgeActOptions,
  ): Promise<unknown>;
  aiNumber(
    prompt: string,
    options?: MidsceneJudgeNumberOptions,
  ): Promise<number>;
}

export interface MidsceneJudgeActOptions {
  abortSignal?: AbortSignal;
  cacheable?: boolean;
  deepLocate?: boolean;
  deepThink?: 'unset' | boolean;
  fileChooserAccept?: string | string[];
}

export interface MidsceneJudgeNumberOptions {
  abortSignal?: AbortSignal;
  domIncluded?: boolean | 'visible-only';
  screenshotIncluded?: boolean;
  [key: string]: unknown;
}

export async function judgeWithAgentUnsafe(
  agent: MidsceneJudgeAgent,
  options: NormalizedJudgeOptions,
): Promise<UiJudgeScore> {
  for (const step of options.steps) {
    await runAiActWithTimeout(
      agent,
      step,
      options.timeoutMs,
      `Timed out while running Midscene step: ${step}`,
    );
  }

  const rawScore = await runAiNumberWithTimeout(
    agent,
    buildJudgePrompt(options),
    options.timeoutMs,
    'Timed out while asking Midscene for a numeric score.',
    SCORE_NUMBER_OPTIONS,
  );

  return normalizeScore(rawScore);
}

function runAiActWithTimeout(
  agent: MidsceneJudgeAgent,
  prompt: string,
  timeoutMs: number,
  message: string,
  actOptions?: Omit<MidsceneJudgeActOptions, 'abortSignal'>,
): Promise<unknown> {
  const abortController = new AbortController();
  return withAbortableTimeout(
    agent.aiAct(prompt, {
      ...actOptions,
      abortSignal: abortController.signal,
    }),
    timeoutMs,
    abortController,
    message,
  );
}

function runAiNumberWithTimeout(
  agent: MidsceneJudgeAgent,
  prompt: string,
  timeoutMs: number,
  message: string,
  numberOptions?: Omit<MidsceneJudgeNumberOptions, 'abortSignal'>,
): Promise<number> {
  const abortController = new AbortController();
  return withAbortableTimeout(
    agent.aiNumber(prompt, {
      ...numberOptions,
      abortSignal: abortController.signal,
    }),
    timeoutMs,
    abortController,
    message,
  );
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
