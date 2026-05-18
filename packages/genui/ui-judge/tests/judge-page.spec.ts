// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { judgePage } from '../src/index.js';

let server: Server;
let baseUrl: string;

function hasMidsceneModelConfig(): boolean {
  return Boolean(process.env['MIDSCENE_MODEL_NAME']);
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
  test.skip(
    !hasMidsceneModelConfig(),
    'MIDSCENE_MODEL_NAME is required for the real Midscene model test.',
  );

  const steps = ['Click the Reveal details button.'];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/interactive`);

  const result = await judgePage({
    page,
    task:
      'The page should show an order confirmation card with a revealed status, shipping date, and 390x844 viewport label.',
    steps,
    timeoutMs: 120_000,
  });

  expect(result).toMatchObject({
    dimension: 'visual-correctness',
    steps,
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
