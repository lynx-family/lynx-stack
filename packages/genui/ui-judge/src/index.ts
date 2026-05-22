// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { Page } from '@playwright/test';

const VISUAL_CORRECTNESS_DIMENSION = 'visual-correctness';
const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_SCORE = 0;
const MAX_SCORE = 5;

export type UiJudgeScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface JudgePageOptions {
  page: Page;
  reference?: string;
  steps?: string[];
  task: string;
  timeoutMs?: number;
}

export interface UiJudgeError {
  message: string;
}

export interface UiJudgeResult {
  dimension: typeof VISUAL_CORRECTNESS_DIMENSION;
  error?: UiJudgeError;
  score: UiJudgeScore;
  steps: string[];
  url: string;
}

interface NormalizedJudgePageOptions {
  page: Page;
  reference?: string;
  steps: string[];
  task: string;
  timeoutMs: number;
}

export async function judgePage(
  options: JudgePageOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeOptions(options);
    const score = await judgePageUnsafe(normalized);
    return {
      dimension: VISUAL_CORRECTNESS_DIMENSION,
      score,
      steps: normalized.steps,
      url: normalized.page.url(),
    };
  } catch (error) {
    return {
      dimension: VISUAL_CORRECTNESS_DIMENSION,
      error: { message: toErrorMessage(error) },
      score: 0,
      steps: normalizeSteps(options?.steps),
      url: getPageUrl(options?.page),
    };
  }
}

async function judgePageUnsafe(
  options: NormalizedJudgePageOptions,
): Promise<UiJudgeScore> {
  await waitForNetworkIdleBestEffort(options.page, options.timeoutMs);

  const agent = new PlaywrightAgent(options.page, {
    autoPrintReportMsg: false,
    generateReport: false,
  });

  try {
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
      agent.aiNumber(buildVisualCorrectnessPrompt(options), {
        domIncluded: 'visible-only',
        screenshotIncluded: true,
      }),
      options.timeoutMs,
      'Timed out while asking Midscene for a numeric score.',
    );

    return normalizeScore(rawScore);
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original action or scoring error visible.
    });
  }
}

function normalizeOptions(
  options: JudgePageOptions,
): NormalizedJudgePageOptions {
  if (!options?.page) {
    throw new Error('judgePage requires a Playwright page.');
  }

  const task = typeof options.task === 'string' ? options.task.trim() : '';
  if (!task) {
    throw new Error('judgePage requires a non-empty task.');
  }

  const normalized: NormalizedJudgePageOptions = {
    page: options.page,
    steps: normalizeSteps(options.steps),
    task,
    timeoutMs: normalizeTimeout(options.timeoutMs),
  };

  const reference = options.reference?.trim();
  if (reference) {
    normalized.reference = reference;
  }

  return normalized;
}

function normalizeSteps(steps: string[] | undefined): string[] {
  return (steps ?? [])
    .filter((step): step is string => typeof step === 'string')
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('judgePage timeoutMs must be a positive finite number.');
  }
  return timeoutMs;
}

function buildVisualCorrectnessPrompt(
  options: NormalizedJudgePageOptions,
): string {
  const reference = options.reference
    ? `\nReference answer or target:\n${options.reference}\n`
    : '';

  return `You are judging the visual correctness of a generated UI.

Task:
${options.task}
${reference}
Set Midscene's requested Number result to exactly one integer from 0 to 5.
Do not return a bare JSON number; the structured result must use the Number field.
Do not return "GRADE:", letters, Markdown, prose, or explanation.

Use this scale:
5 = The UI fully satisfies the task and reference.
4 = The UI is mostly correct, with only minor visual, wording, layout, punctuation, capitalization, or spacing differences.
3 = The UI is partially correct: the core structure is present, but meaningful components, states, data, or relationships are missing or wrong.
2 = A small amount of relevant content is correct, but most important requirements are missing or wrong.
1 = The UI is barely related to the task, with only weakly relevant elements.
0 = The UI is unrelated, blank, failed to render, impossible to inspect, or completely wrong.

Grading notes:
1. Variations in capitalization, punctuation, and minor spacing differences are acceptable when the semantic intent and required components are present.
2. Unless a specific vertical or horizontal order is explicitly requested, variations in component order within a container are acceptable.
3. Generated component IDs do not need to match any specific pattern or example, as long as they are unique and correctly establish the requested parent-child relationships.
4. Minor label variations that preserve the core semantic meaning are acceptable unless exact literal text was requested.
5. Valid optional properties, such as accessibility hints or default values, should not be penalized when they make sense in context.
6. If data binding paths are not explicitly specified, accept any logically sound path structure.
7. Do not award a high score when required components are missing or substantive behavior is wrong.

Think through the criteria internally, then return only the structured Number result.`;
}

async function waitForNetworkIdleBestEffort(
  page: Page,
  timeoutMs: number,
): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', {
      timeout: Math.min(timeoutMs, 5_000),
    });
  } catch {
    // Many real apps keep connections open. The DOM is already loaded, so
    // continue and let Midscene inspect the current state.
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getPageUrl(page: Page | undefined): string {
  try {
    return page?.url() ?? '';
  } catch {
    return '';
  }
}
