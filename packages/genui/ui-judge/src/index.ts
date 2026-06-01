// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { setTimeout as sleep } from 'node:timers/promises';

import type { DeviceAction, Size } from '@midscene/core';
import { Agent as MidsceneAgent } from '@midscene/core/agent';
import {
  defineActionSwipe,
  defineActionTap,
  normalizeMobileSwipeParam,
} from '@midscene/core/device';
import type { AbstractInterface } from '@midscene/core/device';
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

interface MidsceneJudgeAgent {
  aiAct(
    step: string,
    options?: { abortSignal?: AbortSignal },
  ): Promise<unknown>;
  aiNumber(
    prompt: string,
    options?: MidsceneJudgeQueryOptions,
  ): Promise<number>;
}

interface MidsceneJudgeQueryOptions {
  domIncluded?: boolean | 'visible-only';
  screenshotIncluded?: boolean;
}

export interface JudgePageOptions {
  dimension?: UiJudgeDimension;
  page: Page;
  reference?: string;
  steps?: string[];
  task: string;
  timeoutMs?: number;
}

export interface KittenLynxJudgePage {
  screenshot(options?: {
    format?: 'jpeg' | 'png' | 'webp';
    path?: string;
    quality?: number;
  }): Promise<Buffer>;
  url(): string;
}

export interface JudgeAndroidAgentOptions {
  dimension?: UiJudgeDimension;
  page: KittenLynxJudgePage;
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

interface NormalizedJudgeOptions {
  dimension: UiJudgeDimension;
  reference?: string;
  steps: string[];
  task: string;
  timeoutMs: number;
}

interface NormalizedJudgePageOptions extends NormalizedJudgeOptions {
  page: Page;
}

interface NormalizedJudgeAndroidAgentOptions extends NormalizedJudgeOptions {
  page: KittenLynxJudgePage;
}

export async function judgePage(
  options: JudgePageOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeJudgePageOptions(options);
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

export async function judgeAndroidAgent(
  options: JudgeAndroidAgentOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeJudgeAndroidAgentOptions(options);
    const score = await judgeAndroidAgentUnsafe(normalized);
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
      url: getKittenLynxPageUrl(options?.page),
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
    return await judgeWithAgentUnsafe(agent, options, {
      scoreOptions: {
        domIncluded: 'visible-only',
        screenshotIncluded: true,
      },
    });
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original action or scoring error visible.
    });
  }
}

async function judgeAndroidAgentUnsafe(
  options: NormalizedJudgeAndroidAgentOptions,
): Promise<UiJudgeScore> {
  const agent = new MidsceneAgent(
    new KittenLynxMidscenePage(options.page) as AbstractInterface,
    {
      autoPrintReportMsg: false,
      generateReport: false,
    },
  );

  try {
    return await judgeWithAgentUnsafe(agent, options, {
      scoreOptions: {
        screenshotIncluded: true,
      },
    });
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original action or scoring error visible.
    });
  }
}

async function judgeWithAgentUnsafe(
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

function normalizeJudgePageOptions(
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

function normalizeJudgeAndroidAgentOptions(
  options: JudgeAndroidAgentOptions,
): NormalizedJudgeAndroidAgentOptions {
  if (!isKittenLynxPage(options?.page)) {
    throw new Error('judgeAndroidAgent requires a Kitten-Lynx page.');
  }

  const normalized: NormalizedJudgeAndroidAgentOptions = {
    ...normalizeJudgeBaseOptions(options, 'judgeAndroidAgent'),
    page: options.page,
  };

  return normalized;
}

function normalizeJudgeBaseOptions(
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

interface KittenLynxChannel {
  send(method: string, params: Record<string, unknown>): Promise<unknown>;
}

type KittenLynxViewWithChannel = KittenLynxJudgePage & {
  _channel?: KittenLynxChannel;
};

type TouchEventType = 'mousePressed' | 'mouseMoved' | 'mouseReleased';

interface TouchPoint {
  x: number;
  y: number;
}

interface ScreenshotSnapshot {
  base64: string;
  size: Size;
}

class KittenLynxMidscenePage {
  interfaceType = 'lynx-android';
  private screenshotSnapshot: Promise<ScreenshotSnapshot> | undefined;

  constructor(private readonly page: KittenLynxJudgePage) {}

  actionSpace(): DeviceAction[] {
    return [
      defineActionTap(async ({ locate }) => {
        await this.tapAt({
          x: locate.center[0],
          y: locate.center[1],
        });
      }),
      defineActionSwipe(async (param) => {
        const swipe = normalizeMobileSwipeParam(param, await this.size());
        for (let index = 0; index < swipe.repeatCount; index++) {
          await this.swipe(swipe.startPoint, swipe.endPoint, swipe.duration);
        }
      }),
    ];
  }

  async screenshotBase64(): Promise<string> {
    const screenshot = await this.captureScreenshot();
    return screenshot.base64;
  }

  async size(): Promise<Size> {
    const screenshot = await this.captureScreenshot();
    return screenshot.size;
  }

  url(): string {
    return this.page.url();
  }

  describe(): string {
    return this.page.url();
  }

  beforeInvokeAction(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  afterInvokeAction(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    this.screenshotSnapshot = undefined;
    return Promise.resolve();
  }

  private async captureScreenshot(): Promise<ScreenshotSnapshot> {
    this.screenshotSnapshot ??= this.page.screenshot().then(
      (buffer: Buffer) => {
        const format = getImageFormat(buffer);
        return {
          base64: `data:image/${format};base64,${buffer.toString('base64')}`,
          size: getImageSize(buffer, format),
        };
      },
    ).catch((error: unknown) => {
      this.screenshotSnapshot = undefined;
      throw error;
    });

    return await this.screenshotSnapshot;
  }

  private async tapAt(point: TouchPoint): Promise<void> {
    await this.touch('mousePressed', point);
    await sleep(50);
    await this.touch('mouseReleased', point);
  }

  private async swipe(
    startPoint: TouchPoint,
    endPoint: TouchPoint,
    duration: number,
  ): Promise<void> {
    await this.touch('mousePressed', startPoint);
    await sleep(Math.max(0, Math.min(duration, 1000)) / 2);
    await this.touch('mouseMoved', endPoint);
    await sleep(Math.max(0, Math.min(duration, 1000)) / 2);
    await this.touch('mouseReleased', endPoint);
  }

  private async touch(type: TouchEventType, point: TouchPoint): Promise<void> {
    await this.getChannel().send('Input.emulateTouchFromMouseEvent', {
      button: 'left',
      type,
      x: point.x,
      y: point.y,
    });
  }

  private getChannel(): KittenLynxChannel {
    const channel = (this.page as KittenLynxViewWithChannel)._channel;
    if (!channel) {
      throw new Error(
        'Kitten-Lynx page is not attached yet. Call page.goto() before judgeAndroidAgent().',
      );
    }

    return channel;
  }
}

function isKittenLynxPage(page: unknown): page is KittenLynxJudgePage {
  return typeof page === 'object'
    && page !== null
    && 'screenshot' in page
    && 'url' in page
    && typeof page.screenshot === 'function'
    && typeof page.url === 'function';
}

function getKittenLynxPageUrl(page: KittenLynxJudgePage | undefined): string {
  try {
    return isKittenLynxPage(page) ? page.url() : '';
  } catch {
    return '';
  }
}

function getImageFormat(buffer: Buffer): 'jpeg' | 'png' {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return 'png';
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpeg';
  }

  throw new Error('Unsupported Kitten-Lynx screenshot format.');
}

function getImageSize(buffer: Buffer, format: 'jpeg' | 'png'): Size {
  if (format === 'png') {
    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16),
    };
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }

    if (offset + 4 >= buffer.length) {
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0
      && marker <= 0xcf
      && marker !== 0xc4
      && marker !== 0xc8
      && marker !== 0xcc;

    if (isStartOfFrame) {
      if (offset + 8 >= buffer.length) {
        break;
      }

      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  throw new Error('Unable to read Kitten-Lynx screenshot dimensions.');
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
  options: NormalizedJudgeOptions,
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
