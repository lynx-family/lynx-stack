// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NormalizedJudgeOptions, UiJudgeScore } from '../types.js';
import { buildJudgePrompt } from './prompt.js';

const MIN_SCORE = 0;
const MAX_SCORE = 5;
const SCORE_ASK_OPTIONS: Omit<MidsceneJudgeAskOptions, 'abortSignal'> = {
  domIncluded: false,
  screenshotIncluded: true,
};

export interface MidsceneJudgeAgent {
  aiAct(
    step: string,
    options?: MidsceneJudgeActOptions,
  ): Promise<unknown>;
  aiAsk(
    prompt: string,
    options?: MidsceneJudgeAskOptions,
  ): Promise<unknown>;
}

export interface MidsceneJudgeActOptions {
  abortSignal?: AbortSignal;
  cacheable?: boolean;
  deepLocate?: boolean;
  deepThink?: 'unset' | boolean;
  fileChooserAccept?: string | string[];
}

export interface MidsceneJudgeAskOptions {
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

  const rawScore = await runAiAskWithTimeout(
    agent,
    buildJudgePrompt(options),
    options.timeoutMs,
    'Timed out while asking Midscene for a score.',
    SCORE_ASK_OPTIONS,
  );

  return normalizeScore(parseScore(rawScore));
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

function runAiAskWithTimeout(
  agent: MidsceneJudgeAgent,
  prompt: string,
  timeoutMs: number,
  message: string,
  askOptions?: Omit<MidsceneJudgeAskOptions, 'abortSignal'>,
): Promise<unknown> {
  const abortController = new AbortController();
  return withAbortableTimeout(
    agent.aiAsk(prompt, {
      ...askOptions,
      abortSignal: abortController.signal,
    }),
    timeoutMs,
    abortController,
    message,
  );
}

function parseScore(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return parseScoreText(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const score = tryParseScore(item);
      if (score !== undefined) return score;
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (
      const key of [
        'score',
        'value',
        'number',
        'result',
        'answer',
        'output',
        'content',
      ]
    ) {
      if (key in record) {
        const score = tryParseScore(record[key]);
        if (score !== undefined) return score;
      }
    }
  }

  throw new Error(
    `Midscene returned an unparsable score: ${formatValue(value)}.`,
  );
}

function tryParseScore(value: unknown): number | undefined {
  try {
    return parseScore(value);
  } catch {
    return undefined;
  }
}

function parseScoreText(value: string): number {
  const trimmed = value.trim();
  const parsedJson = tryParseJson(trimmed);
  if (parsedJson !== undefined) {
    const score = tryParseScore(parsedJson);
    if (score !== undefined) return score;
  }

  const explicitScore = /\bSCORE\s*[:=]\s*([0-5])\b/i.exec(trimmed);
  if (explicitScore) {
    return Number(explicitScore[1]);
  }

  const scoreOutOfFive = /\b([0-5])\s*\/\s*5\b/.exec(trimmed);
  if (scoreOutOfFive) {
    return Number(scoreOutOfFive[1]);
  }

  if (/^[0-5]$/.test(trimmed)) {
    return Number(trimmed);
  }

  const scoreTokens = trimmed.match(/\b[0-5]\b/g) ?? [];
  const uniqueScores = new Set(scoreTokens);
  if (uniqueScores.size === 1) {
    return Number(scoreTokens[0]);
  }

  throw new Error(
    `Midscene returned an unparsable score: ${formatValue(value)}.`,
  );
}

function tryParseJson(value: string): unknown {
  if (!value.startsWith('{') && !value.startsWith('[')) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
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

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
