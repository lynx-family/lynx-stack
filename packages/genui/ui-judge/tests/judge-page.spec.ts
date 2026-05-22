// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { judgePage } from '../src/index.js';
import type { UiJudgeResult } from '../src/index.js';
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
}

const PLAYGROUND_DEMO_CASES: PlaygroundDemoCase[] = [
  {
    demoId: 'recs',
    readyText: 'Recommendations: Date-Night Dining Ideas',
    expectedText: 'Sea Breeze Kitchen',
  },
  {
    demoId: 'trip-planner',
    readyText: 'Trip Planner: Kyoto in 48 Hours',
    expectedText: 'Monkey Park Viewpoint',
  },
  {
    demoId: 'weather-current',
    readyText: 'Austin, TX',
    expectedText: 'Clear skies with light breeze',
  },
  {
    demoId: 'product-card',
    readyText: 'Wireless Headphones Pro',
    expectedText: 'Add to Cart',
  },
];
const JUDGE_DEMO: PlaygroundDemoCase = PLAYGROUND_DEMO_CASES[0]!;
const UI_JUDGE_RESULT_FILE_ENV = 'UI_JUDGE_RESULT_FILE';

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

  test('scores a playground render.html demo with speed zero', async ({ page }) => {
    test.setTimeout(300_000);

    if (!previewServer) {
      throw new Error('A2UI playground preview server was not started.');
    }

    const previewUrl = previewServer.createDemoPreviewUrl({
      demoId: JUDGE_DEMO.demoId,
      speed: 0,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(previewUrl);
    await waitForPreviewText(page, JUDGE_DEMO.readyText);
    await waitForPreviewText(page, JUDGE_DEMO.expectedText, 2_000);

    const task =
      'The A2UI playground preview should show date-night dining recommendations for Moonlight Terrace, Pinewood Bistro, and Sea Breeze Kitchen.';
    const result = await judgePage({
      page,
      task,
      timeoutMs: 180_000,
    });

    await writeUiJudgeResult({
      result,
      task,
    });

    expect(result).toMatchObject({
      dimension: 'visual-correctness',
      steps: [],
      url: previewUrl,
    });
    expect(result.error).toBeUndefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(5);
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

async function writeUiJudgeResult({
  result,
  task,
}: {
  result: UiJudgeResult;
  task: string;
}): Promise<void> {
  const resultFile = process.env[UI_JUDGE_RESULT_FILE_ENV];
  if (!resultFile) return;

  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(
    resultFile,
    `${JSON.stringify({ results: [{ ...result, task }] }, null, 2)}\n`,
    'utf8',
  );
}
