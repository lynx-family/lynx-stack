// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { Page } from '@playwright/test';

const DEFAULT_DIMENSION = 'visual-correctness';
const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_SCORE = 0;
const MAX_SCORE = 5;

export type UiJudgeDimension =
  | 'visual-correctness'
  | 'usability-interaction'
  | 'visual-aesthetics'
  | 'consistency-standards'
  | 'architecture-writing'
  | 'accessibility-performance';

export type UiJudgeScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface JudgePageOptions {
  dimension?: UiJudgeDimension;
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
  dimension: UiJudgeDimension;
  error?: UiJudgeError;
  score: UiJudgeScore;
  steps: string[];
  url: string;
}

interface NormalizedJudgePageOptions {
  dimension: UiJudgeDimension;
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
      dimension: normalized.dimension,
      score,
      steps: normalized.steps,
      url: normalized.page.url(),
    };
  } catch (error) {
    return {
      dimension: getResultDimension(options?.dimension),
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
      agent.aiNumber(buildJudgePrompt(options), {
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
    dimension: normalizeDimension(options.dimension),
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

function normalizeDimension(
  dimension: UiJudgeDimension | undefined,
): UiJudgeDimension {
  if (dimension === undefined) return DEFAULT_DIMENSION;
  if (isKnownDimension(dimension)) return dimension;

  throw new Error(
    `judgePage dimension must be one of: ${getDimensionNames().join(', ')}.`,
  );
}

function getResultDimension(
  dimension: UiJudgeDimension | undefined,
): UiJudgeDimension {
  return isKnownDimension(dimension) ? dimension : DEFAULT_DIMENSION;
}

function isKnownDimension(
  dimension: UiJudgeDimension | undefined,
): dimension is UiJudgeDimension {
  return typeof dimension === 'string'
    && Object.hasOwn(JUDGE_DIMENSION_PROMPTS, dimension);
}

function getDimensionNames(): string[] {
  return Object.keys(JUDGE_DIMENSION_PROMPTS).sort();
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

interface JudgeDimensionPromptDefinition {
  criteria: readonly string[];
  focus: string;
  title: string;
}

const JUDGE_DIMENSION_PROMPTS: Record<
  UiJudgeDimension,
  JudgeDimensionPromptDefinition
> = {
  'accessibility-performance': {
    title: 'Accessibility & Performance',
    focus:
      'Judge whether the UI feels inclusive, robust across screen sizes, and technically mature under real usage conditions.',
    criteria: [
      'WCAG contrast and non-color cues: text/background contrast should meet AA expectations, and important states should not rely only on color.',
      'Touch targets and responsive behavior: interactive areas should be easy to tap, and the layout should avoid overlap, truncation, or broken adaptation.',
      'Perceived performance: loading, large data, or waiting states should use skeletons, progressive loading, optimistic feedback, or other anxiety-reducing patterns when relevant.',
    ],
  },
  'architecture-writing': {
    title: 'Information Architecture & UX Writing',
    focus:
      'Judge whether users can quickly find what they need, understand where they are, and act on clear product language.',
    criteria: [
      'Wayfinding and navigation: navigation should be flat enough for the task, with clear current location, next destinations, and return paths when relevant.',
      'Microcopy: buttons, labels, and helper text should be concise, consistent, action-oriented, and free of ambiguity.',
      'Empty states: no-data, first-use, or no-result states should feel intentional and provide a useful next action instead of dead ends.',
    ],
  },
  'consistency-standards': {
    title: 'Consistency & Standards',
    focus:
      'Judge whether the UI follows expected design-system, product, and platform conventions so it lowers both implementation and learning cost.',
    criteria: [
      'Design-system fit: components, spacing, radius, color, and typography should look tokenized and reusable rather than improvised.',
      'Internal consistency: repeated components and behaviors should stay consistent across cards, lists, controls, dialogs, and modules.',
      'Platform conventions: icons, gestures, search, settings, navigation, and form behaviors should match familiar iOS, Android, or web standards for the visible context.',
    ],
  },
  'usability-interaction': {
    title: 'Usability & Interaction Logic',
    focus:
      'Judge whether the product is easy to understand, easy to operate, and resilient when users take normal actions.',
    criteria: [
      'Cognitive load: information density should be reasonable, and the page purpose should be understandable within about one second.',
      'System feedback: clicks, hover states, loading, success, and error transitions should provide immediate and clear feedback when visible in the current state.',
      'Error recovery: destructive or high-stakes actions should show confirmation, and errors should use human language with a clear recovery path when relevant.',
      'Task efficiency: the core flow should minimize unnecessary steps and use smart defaults, history, shortcuts, or direct actions for frequent tasks when appropriate.',
    ],
  },
  'visual-aesthetics': {
    title: 'Visual Communication & Aesthetics',
    focus:
      'Judge whether the interface looks professional, trustworthy, and visually comfortable while guiding attention to the right actions.',
    criteria: [
      'Visual hierarchy: the primary action and most important information should be prominent, with clear contrast in size, weight, color, and placement.',
      'Typography and whitespace: spacing should follow Gestalt proximity, related elements should group naturally, and the layout should have enough breathing room.',
      'Color semantics: brand, neutral, warning, success, and emphasis colors should be restrained, meaningful, and consistent.',
      'Graphics and icons: icon stroke, corner style, illustration quality, imagery, and decorative graphics should feel consistent and support comprehension.',
    ],
  },
  'visual-correctness': {
    title: 'Visual Correctness',
    focus:
      'Judge whether the generated UI visually satisfies the requested task and reference content.',
    criteria: [
      'Required content: the expected components, labels, data, and relationships should be present.',
      'Task fit: the visible UI should match the requested scenario rather than merely showing related generic content.',
      'Rendering quality: the page should not be blank, broken, clipped, or impossible to inspect.',
    ],
  },
};

function buildJudgePrompt(
  options: NormalizedJudgePageOptions,
): string {
  const dimensionPrompt = JUDGE_DIMENSION_PROMPTS[options.dimension];
  const reference = options.reference
    ? `\nReference answer or target:\n${options.reference}\n`
    : '';

  return `You are a senior product and design reviewer judging one GEQI dimension of a generated UI.

Dimension:
${dimensionPrompt.title}

Dimension focus:
${dimensionPrompt.focus}

Task:
${options.task}
${reference}
Set Midscene's requested Number result to exactly one integer from 0 to 5.
Do not return a bare JSON number; the structured result must use the Number field.
Do not return "GRADE:", letters, Markdown, prose, or explanation.

Use this 1-5 Likert scale for the requested dimension:
5 = Excellent benchmark: exceptional craft, thoughtful details, and an "aha moment" that exceeds expectations.
4 = Strong professional quality: smooth, comfortable, and aligned with industry best practices.
3 = Acceptable baseline: the core task works with no fatal issue, but the experience is ordinary or under-polished.
2 = Poor with clear defects: noticeable friction, inconsistency, confusion, or frustration.
1 = Disaster or blocker: seriously violates interaction common sense or blocks the core flow and should be redone.
0 = The UI is unrelated, blank, failed to render, impossible to inspect, or completely wrong.

Subcriteria for this dimension:
${
    dimensionPrompt.criteria.map((criterion, index) =>
      `${index + 1}. ${criterion}`
    ).join('\n')
  }

Grading notes:
1. Score only the requested dimension; do not collapse all GEQI dimensions into one general quality score.
2. Variations in capitalization, punctuation, and minor spacing differences are acceptable when semantic intent and required components are present.
3. Unless a specific vertical or horizontal order is explicitly requested, variations in component order within a container are acceptable.
4. Minor label variations that preserve core semantic meaning are acceptable unless exact literal text was requested.
5. Valid optional properties, such as accessibility hints or default values, should not be penalized when they make sense in context.
6. Do not award a high score when required components are missing or substantive behavior is wrong for this dimension.

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
