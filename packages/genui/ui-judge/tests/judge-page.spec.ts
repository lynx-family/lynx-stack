// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { judgePage } from '../src/index.js';
import type { UiJudgeDimension, UiJudgeResult } from '../src/index.js';
import {
  startPlaygroundPreviewServer,
} from './helpers/playground-preview-server.js';
import type { PlaygroundPreviewServer } from './helpers/playground-preview-server.js';

function hasMidsceneModelConfig(): boolean {
  return Boolean(process.env['MIDSCENE_MODEL_NAME']);
}

interface PlaygroundDemoCase {
  demoId: string;
  expectedText: string;
  readyText: string;
  task: string;
}

interface GeqiDimensionCase {
  dimension: UiJudgeDimension;
  label: string;
  weight: number;
}

const GEQI_DIMENSION_CASES: GeqiDimensionCase[] = [
  {
    dimension: 'usability-interaction',
    label: 'Usability & Interaction',
    weight: 30,
  },
  {
    dimension: 'visual-aesthetics',
    label: 'Visual & Aesthetics',
    weight: 25,
  },
  {
    dimension: 'consistency-standards',
    label: 'Consistency & Standards',
    weight: 15,
  },
  {
    dimension: 'architecture-writing',
    label: 'Architecture & UX Writing',
    weight: 15,
  },
  {
    dimension: 'accessibility-performance',
    label: 'Accessibility & Performance',
    weight: 15,
  },
];

const PLAYGROUND_DEMO_CASES: PlaygroundDemoCase[] = [
  {
    demoId: 'recs',
    readyText: 'Recommendations: Date-Night Dining Ideas',
    expectedText: 'Sea Breeze Kitchen',
    task:
      'The A2UI playground preview should show date-night dining recommendations for Moonlight Terrace, Pinewood Bistro, and Sea Breeze Kitchen.',
  },
  {
    demoId: 'cast-grid',
    readyText: 'AI generated answer',
    expectedText: 'Zhou Ning',
    task:
      'The A2UI playground preview should show a cast grid for the short film Night Notes, including Lin Xia and Zhou Ning cast cards.',
  },
  {
    demoId: 'citywalk-list',
    readyText: 'AI Answer: Weekend Citywalk Coffee Picks',
    expectedText: 'Late Sun Roastery',
    task:
      'The A2UI playground preview should show weekend citywalk coffee picks with Rooftop Brew Room, Corner Canvas Lab, and Late Sun Roastery.',
  },
  {
    demoId: 'fridge-search',
    readyText: 'Refrigerators',
    expectedText: 'Midea 550L Frost-Free French-Door Fridge',
    task:
      'The A2UI playground preview should show refrigerator search results with Siemens, Hualing, Haier, and Midea product cards.',
  },
  {
    demoId: 'trip-planner',
    readyText: 'Trip Planner: Kyoto in 48 Hours',
    expectedText: 'Monkey Park Viewpoint',
    task:
      'The A2UI playground preview should show a Kyoto 48-hour trip planner with Day 1 and Day 2 itinerary sections, including Monkey Park Viewpoint.',
  },
  {
    demoId: 'weather-current',
    readyText: 'Austin, TX',
    expectedText: 'Clear skies with light breeze',
    task:
      'The A2UI playground preview should show the current weather for Austin, TX, including clear skies with light breeze.',
  },
  {
    demoId: 'product-card',
    readyText: 'Wireless Headphones Pro',
    expectedText: 'Add to Cart',
    task:
      'The A2UI playground preview should show a Wireless Headphones Pro product card with a visible Add to Cart action.',
  },
  {
    demoId: 'workout-plan',
    readyText: 'Weekly Workout Plan',
    expectedText: 'Friday',
    task:
      'The A2UI playground preview should show a weekly workout plan with five days from Monday Ramp-Up through Friday Conditioning.',
  },
];
const UI_JUDGE_RESULT_FILE_ENV = 'UI_JUDGE_RESULT_FILE';
const judgedResultsByDemo = new Map<string, JudgedPlaygroundResult>();

test.describe('A2UI playground preview', () => {
  test.skip(
    !hasMidsceneModelConfig(),
    'MIDSCENE_MODEL_NAME is required for the real Midscene model test.',
  );

  let previewServer: PlaygroundPreviewServer | undefined;

  test.beforeAll(async () => {
    previewServer = await startPlaygroundPreviewServer();
  });

  test.afterAll(async () => {
    await previewServer?.dispose();
  });

  for (const demo of PLAYGROUND_DEMO_CASES) {
    test(`renders playground example ${demo.demoId} with speed zero`, async ({ page }) => {
      if (!previewServer) {
        throw new Error('A2UI playground preview server was not started.');
      }

      const previewUrl = previewServer.createDemoPreviewUrl({
        demoId: demo.demoId,
        speed: 0,
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(previewUrl);
      await waitForPreviewText(page, demo.readyText);
      await waitForPreviewText(page, demo.expectedText, 2_000);
    });
  }

  test('scores playground render.html demos with speed zero', async ({ page }) => {
    test.setTimeout(1_200_000);

    if (!previewServer) {
      throw new Error('A2UI playground preview server was not started.');
    }

    const server = previewServer;
    await page.setViewportSize({ width: 390, height: 844 });

    for (const demo of PLAYGROUND_DEMO_CASES) {
      await test.step(`score ${demo.demoId}`, async () => {
        const previewUrl = server.createDemoPreviewUrl({
          demoId: demo.demoId,
          speed: 0,
        });

        await page.goto(previewUrl);
        await waitForPreviewText(page, demo.readyText);
        await waitForPreviewText(page, demo.expectedText, 2_000);

        const result = await judgePage({
          page,
          task: demo.task,
          timeoutMs: 180_000,
        });

        upsertVisualJudgeResult(demo, result);
        await writeUiJudgeResults();

        expect(result).toMatchObject({
          dimension: 'visual-correctness',
          steps: [],
          url: previewUrl,
        });
        expect(result.error).toBeUndefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(5);
      });
    }
  });

  test('adds GEQI dimension scores for playground render.html demos with speed zero', async ({ page }) => {
    test.setTimeout(1_500_000);

    if (!previewServer) {
      throw new Error('A2UI playground preview server was not started.');
    }

    const server = previewServer;
    await page.setViewportSize({ width: 390, height: 844 });

    for (const demo of PLAYGROUND_DEMO_CASES) {
      await test.step(`score GEQI dimensions for ${demo.demoId}`, async () => {
        const previewUrl = server.createDemoPreviewUrl({
          demoId: demo.demoId,
          speed: 0,
        });

        await page.goto(previewUrl);
        await waitForPreviewText(page, demo.readyText);
        await waitForPreviewText(page, demo.expectedText, 2_000);

        for (const dimensionCase of GEQI_DIMENSION_CASES) {
          await test.step(`${demo.demoId} ${dimensionCase.dimension}`, async () => {
            const result = await judgePage({
              dimension: dimensionCase.dimension,
              page,
              task: demo.task,
              timeoutMs: 90_000,
            });

            upsertGeqiDimensionJudgeResult(demo, dimensionCase, result);
            await writeUiJudgeResults();

            expect(result).toMatchObject({
              dimension: dimensionCase.dimension,
              steps: [],
              url: previewUrl,
            });
            expect(result.error).toBeUndefined();
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(5);
          });
        }
      });
    }
  });
});

test('returns a JSON error when input validation fails', async ({ page }) => {
  await page.setContent('<main><h1>Order Confirmed</h1></main>');
  const url = page.url();

  const result = await judgePage({
    page,
    task: '',
    timeoutMs: 3_000,
  });

  expect(result).toMatchObject({
    dimension: 'visual-correctness',
    score: 0,
    steps: [],
    url,
  });
  expect(result.error?.message).toBeTruthy();
});

async function waitForPreviewText(
  page: Page,
  text: string,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    (expectedText) => {
      const lynxView = document.querySelector('lynx-view');
      const shadowText = lynxView?.shadowRoot?.textContent ?? '';
      return shadowText.includes(expectedText)
        || document.body.textContent?.includes(expectedText) === true;
    },
    text,
    { timeout },
  );
}

interface JudgedPlaygroundResult {
  demoId: string;
  dimensions: JudgedGeqiDimensionResult[];
  result: UiJudgeResult;
  task: string;
}

interface JudgedGeqiDimensionResult {
  dimension: UiJudgeDimension;
  dimensionLabel: string;
  error?: UiJudgeResult['error'];
  score: UiJudgeResult['score'];
  steps: string[];
  url: string;
  weight: number;
}

function upsertVisualJudgeResult(
  demo: PlaygroundDemoCase,
  result: UiJudgeResult,
): void {
  const existing = judgedResultsByDemo.get(demo.demoId);
  judgedResultsByDemo.set(demo.demoId, {
    demoId: demo.demoId,
    dimensions: existing?.dimensions ?? [],
    result,
    task: demo.task,
  });
}

function upsertGeqiDimensionJudgeResult(
  demo: PlaygroundDemoCase,
  dimensionCase: GeqiDimensionCase,
  result: UiJudgeResult,
): void {
  const judgedResult = judgedResultsByDemo.get(demo.demoId) ?? {
    demoId: demo.demoId,
    dimensions: [],
    result: createMissingVisualJudgeResult(result),
    task: demo.task,
  };
  const dimensions = judgedResult.dimensions.filter(
    (dimensionResult) => dimensionResult.dimension !== dimensionCase.dimension,
  );
  dimensions.push({
    dimension: result.dimension,
    dimensionLabel: dimensionCase.label,
    error: result.error,
    score: result.score,
    steps: result.steps,
    url: result.url,
    weight: dimensionCase.weight,
  });

  judgedResultsByDemo.set(demo.demoId, {
    ...judgedResult,
    dimensions: sortGeqiDimensions(dimensions),
  });
}

function createMissingVisualJudgeResult(result: UiJudgeResult): UiJudgeResult {
  return {
    dimension: 'visual-correctness',
    error: {
      message: 'visual-correctness judge did not run before GEQI scoring.',
    },
    score: 0,
    steps: [],
    url: result.url,
  };
}

function sortGeqiDimensions(
  dimensions: JudgedGeqiDimensionResult[],
): JudgedGeqiDimensionResult[] {
  return GEQI_DIMENSION_CASES.map((dimensionCase) =>
    dimensions.find((dimensionResult) =>
      dimensionResult.dimension === dimensionCase.dimension
    )
  ).filter((dimension): dimension is JudgedGeqiDimensionResult =>
    dimension !== undefined
  );
}

async function writeUiJudgeResults(): Promise<void> {
  const judgedResults = [...judgedResultsByDemo.values()];
  if (judgedResults.length === 0) return;

  const resultFile = process.env[UI_JUDGE_RESULT_FILE_ENV];
  if (!resultFile) return;

  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(
    resultFile,
    `${
      JSON.stringify(
        {
          results: judgedResults.map((
            { demoId, dimensions, result, task },
          ) => ({
            ...result,
            demoId,
            dimensions,
            task,
          })),
        },
        null,
        2,
      )
    }\n`,
    'utf8',
  );
}
