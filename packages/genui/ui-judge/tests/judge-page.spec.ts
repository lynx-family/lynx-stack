// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';

import { expect, test } from '@playwright/test';

import { judgePage } from '../src/index.js';

let server: Server;
let baseUrl: string;

const INTERACTIVE_TASK =
  'The page should show an order confirmation card with a revealed status, shipping date, and 390x844 viewport label.';
const INTERACTIVE_STEPS = ['Click the Reveal details button.'];

function hasMidsceneModelConfig(): boolean {
  return Boolean(process.env['MIDSCENE_MODEL_NAME']);
}

async function writeUiJudgeCiResult(
  payload: Record<string, unknown>,
): Promise<void> {
  const resultPath = process.env['UI_JUDGE_RESULT_PATH'];
  if (!resultPath) {
    return;
  }

  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
}

test.beforeAll(async () => {
  const fixtureHtml = await readFile(
    new URL('./fixtures/interactive.html', import.meta.url),
    'utf8',
  );

  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/interactive') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test('scores a caller-provided page after Midscene interactions', async ({ page }) => {
  if (!hasMidsceneModelConfig()) {
    await writeUiJudgeCiResult({
      dimension: 'visual-correctness',
      reason:
        'MIDSCENE_MODEL_NAME is required for the real Midscene model test.',
      score: null,
      status: 'skipped',
      task: INTERACTIVE_TASK,
    });
    test.skip(
      true,
      'MIDSCENE_MODEL_NAME is required for the real Midscene model test.',
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/interactive`);

  const result = await judgePage({
    page,
    task: INTERACTIVE_TASK,
    steps: INTERACTIVE_STEPS,
    timeoutMs: 120_000,
  });
  await writeUiJudgeCiResult({
    dimension: result.dimension,
    error: result.error,
    modelConfigured: true,
    score: result.score,
    status: 'completed',
    steps: result.steps,
    task: INTERACTIVE_TASK,
    url: result.url,
  });

  expect(result).toMatchObject({
    dimension: 'visual-correctness',
    steps: INTERACTIVE_STEPS,
    url: `${baseUrl}/interactive`,
  });
  expect(result.error).toBeUndefined();
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(5);
});

test('returns a JSON error when input validation fails', async ({ page }) => {
  await page.goto(`${baseUrl}/interactive`);

  const result = await judgePage({
    page,
    task: '',
    timeoutMs: 3_000,
  });

  expect(result).toMatchObject({
    dimension: 'visual-correctness',
    score: 0,
    steps: [],
    url: `${baseUrl}/interactive`,
  });
  expect(result.error?.message).toBeTruthy();
});
