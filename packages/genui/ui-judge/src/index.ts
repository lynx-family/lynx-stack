// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { PlaywrightAgent } from '@midscene/web/playwright';
import { chromium } from '@playwright/test';
import type { Browser, Page, ViewportSize } from '@playwright/test';

const VISUAL_CORRECTNESS_DIMENSION = 'visual-correctness';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_VIEWPORT: ViewportSize = { width: 390, height: 844 };
const MIN_SCORE = 0;
const MAX_SCORE = 5;

export type UiJudgeScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface JudgeUrlOptions {
  headed?: boolean;
  reference?: string;
  steps?: string[];
  task: string;
  timeoutMs?: number;
  url: string;
  viewport?: ViewportSize;
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

interface NormalizedJudgeUrlOptions {
  headed: boolean;
  reference?: string;
  steps: string[];
  task: string;
  timeoutMs: number;
  url: string;
  viewport: ViewportSize;
}

export async function judgeUrl(
  options: JudgeUrlOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeOptions(options);
    const score = await judgeUrlUnsafe(normalized);
    return {
      dimension: VISUAL_CORRECTNESS_DIMENSION,
      score,
      steps: normalized.steps,
      url: normalized.url,
    };
  } catch (error) {
    return {
      dimension: VISUAL_CORRECTNESS_DIMENSION,
      error: { message: toErrorMessage(error) },
      score: 0,
      steps: normalizeSteps(options.steps),
      url: String(options.url ?? '').trim(),
    };
  }
}

async function judgeUrlUnsafe(
  options: NormalizedJudgeUrlOptions,
): Promise<UiJudgeScore> {
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: !options.headed,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({ viewport: options.viewport });
    page.setDefaultTimeout(options.timeoutMs);
    page.setDefaultNavigationTimeout(options.timeoutMs);

    await page.goto(options.url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });

    await waitForNetworkIdleBestEffort(page, options.timeoutMs);

    const agent = new PlaywrightAgent(page, {
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
        // Keep the original navigation, action, or scoring error visible.
      });
    }
  } finally {
    await browser?.close();
  }
}

function normalizeOptions(
  options: JudgeUrlOptions,
): NormalizedJudgeUrlOptions {
  const url = options.url.trim();
  if (!url) {
    throw new Error('judgeUrl requires a non-empty url.');
  }

  const task = options.task.trim();
  if (!task) {
    throw new Error('judgeUrl requires a non-empty task.');
  }

  const normalized: NormalizedJudgeUrlOptions = {
    headed: options.headed ?? false,
    steps: normalizeSteps(options.steps),
    task,
    timeoutMs: normalizeTimeout(options.timeoutMs),
    url,
    viewport: normalizeViewport(options.viewport),
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
    throw new Error('judgeUrl timeoutMs must be a positive finite number.');
  }
  return timeoutMs;
}

function normalizeViewport(viewport: ViewportSize | undefined): ViewportSize {
  if (!viewport) return DEFAULT_VIEWPORT;
  if (
    !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0
  ) {
    throw new Error(
      'judgeUrl viewport must contain positive width and height.',
    );
  }
  return {
    height: Math.round(viewport.height),
    width: Math.round(viewport.width),
  };
}

function buildVisualCorrectnessPrompt(
  options: NormalizedJudgeUrlOptions,
): string {
  const reference = options.reference
    ? `\nReference answer or target:\n${options.reference}\n`
    : '';

  return `You are judging the visual correctness of a generated UI.

Task:
${options.task}
${reference}
Return exactly one integer from 0 to 5. Do not return "GRADE:", letters, Markdown, prose, or explanation.

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

Think through the criteria internally, then return only the final integer score.`;
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
