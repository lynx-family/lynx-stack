// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import type { ScreenshotEvaluation } from '../agent/ui-judge-agent.js';
import { evaluateScreenshot } from '../agent/ui-judge-agent.js';
import * as actualJudge from '../agent/ui-judge-agent.js' with {
  rstest: 'importActual',
};
import {
  probeGenuiBenchUiJudge,
  runGenuiBenchUiJudge,
} from '../service/genui-bench-judge.js';

rstest.mock('../agent/ui-judge-agent.js', () => ({
  ...actualJudge,
  evaluateScreenshot: rstest.fn(),
}));

const CAPTURED_BMP = Buffer.from(
  'Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AP8AgP8AAAA8KBT/',
  'base64',
);

function evaluationResponse(value: unknown, init?: ResponseInit): Response {
  if (init?.status && init.status >= 400) return Response.json(value, init);
  rstest.mocked(evaluateScreenshot).mockResolvedValue(
    value as ScreenshotEvaluation,
  );
  return new Response(CAPTURED_BMP, {
    headers: { 'Content-Type': 'image/bmp' },
  });
}

const GEQI_DIMENSIONS = [
  ['usability-interaction', 'Usability & Interaction Logic', 30],
  ['visual-aesthetics', 'Visual Communication & Aesthetics', 25],
  ['consistency-standards', 'Consistency & Standards', 15],
  ['architecture-writing', 'Information Architecture & UX Writing', 15],
] as const;

function geqiResponse(score: number): {
  dimensions: Array<{
    dimension: string;
    dimensionLabel: string;
    score: number;
    weight: number;
  }>;
  geqiScore: number;
  score: number;
} {
  return {
    dimensions: GEQI_DIMENSIONS.map(([dimension, dimensionLabel, weight]) => ({
      dimension,
      dimensionLabel,
      score,
      weight,
    })),
    geqiScore: score * 20,
    score,
  };
}

describe('probeGenuiBenchUiJudge', () => {
  test('selects the OpenUI bundle independently', async () => {
    const capability = await probeGenuiBenchUiJudge('openui', {
      env: {
        UI_JUDGE_OPENUI_BUNDLE_URL: 'https://assets.test/openui.lynx.js',
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () =>
        Promise.resolve(
          Response.json({
            status: 'ok',
          }),
        ),
    });

    expect(capability).toEqual({
      enabled: true,
      session: {
        bundleUrl: 'https://assets.test/openui.lynx.js',
        screenshotUrl: 'http://judge.test/screenshot/template',
      },
    });
  });

  test('does not configure or validate the UI Judge model', async () => {
    const capability = await probeGenuiBenchUiJudge('a2ui', {
      env: {
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () =>
        Promise.resolve(
          Response.json({ model: 'another-model', status: 'ok' }),
        ),
    });

    expect(capability.enabled).toBe(true);
  });
});

describe('runGenuiBenchUiJudge', () => {
  test('injects OpenUI source into the OpenUI bundle', async () => {
    let body: unknown;
    const result = await runGenuiBenchUiJudge(
      {
        artifact: {
          protocol: 'openui',
          rawText: 'root = TextContent("Hello")',
        },
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'https://assets.test/openui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
      },
      (_input, init) => {
        const requestBody = typeof init?.body === 'string' ? init.body : '';
        body = JSON.parse(requestBody) as unknown;
        return Promise.resolve(evaluationResponse(geqiResponse(4)));
      },
    );

    expect(body).toEqual({
      globalProps: {
        benchMode: true,
        instant: true,
        rawText: 'root = TextContent("Hello")',
        speed: 0,
        theme: 'light',
      },
      screenshotSettleMs: 1_000,
      url: 'https://assets.test/openui.lynx.js',
    });
    expect(result).toMatchObject({
      dimensions: geqiResponse(4).dimensions,
      errors: [],
      geqiScore: 80,
      score: 4,
      status: 'complete',
      warnings: [],
    });
  });

  test('lets the A2UI React effects settle before Phase 2 capture', async () => {
    let body: unknown;
    const result = await runGenuiBenchUiJudge(
      {
        artifact: {
          messages: [{
            createSurface: {
              catalogId: 'matched-core-v1',
              surfaceId: 'main',
            },
            version: 'v0.9',
          }],
          protocol: 'a2ui',
        },
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
      },
      (_input, init) => {
        const requestBody = typeof init?.body === 'string' ? init.body : '';
        body = JSON.parse(requestBody) as unknown;
        return Promise.resolve(evaluationResponse(geqiResponse(4)));
      },
    );

    expect(body).toEqual({
      globalProps: {
        benchMode: true,
        instant: true,
        messages: [{
          createSurface: {
            catalogId: 'matched-core-v1',
            surfaceId: 'main',
          },
          version: 'v0.9',
        }],
        speed: 0,
        theme: 'light',
      },
      screenshotSettleMs: 1_000,
      url: 'https://assets.test/a2ui.lynx.js',
    });
    expect(result).toMatchObject({
      dimensions: geqiResponse(4).dimensions,
      errors: [],
      geqiScore: 80,
      score: 4,
      status: 'complete',
      warnings: [],
    });
  });

  test('retries the same safe artifact once after a sidecar failure', async () => {
    let calls = 0;
    const requestBodies: string[] = [];
    const requestUrls: string[] = [];
    const result = await runGenuiBenchUiJudge(
      {
        artifact: {
          messages: [{
            updateComponents: {
              components: [{
                component: 'Image',
                id: 'hero',
                url: 'https://untrusted.test/hero.png',
              }],
              surfaceId: 'main',
            },
            version: 'v0.9',
          }],
          protocol: 'a2ui',
        },
        retryDelayMs: 0,
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
      },
      (input, init) => {
        calls++;
        requestUrls.push(String(input));
        requestBodies.push(
          typeof init?.body === 'string' ? init.body : '',
        );
        return Promise.resolve(
          calls === 1
            ? evaluationResponse(
              { error: { message: 'temporarily unavailable' } },
              { status: 503 },
            )
            : evaluationResponse({
              ...geqiResponse(5),
            }),
        );
      },
    );

    expect(calls).toBe(2);
    expect(requestUrls).toEqual([
      'http://judge.test/screenshot/template',
      'http://judge.test/screenshot/template',
    ]);
    expect(requestBodies[0]).toBe(requestBodies[1]);
    expect(result).toMatchObject({
      dimensions: geqiResponse(5).dimensions,
      errors: [],
      geqiScore: 100,
      score: 5,
      screenshotDataUrl: expect.stringMatching(
        /^data:image\/png;base64,/u,
      ) as unknown,
      status: 'complete',
      warnings: [
        'ui-judge replaced 1 Image component to prevent untrusted resource loading.',
      ],
    });
  });

  test('returns the final result after both sidecar attempts fail', async () => {
    let calls = 0;
    const result = await runGenuiBenchUiJudge(
      {
        artifact: {
          protocol: 'openui',
          rawText: 'root = TextContent("Retry")',
        },
        attemptCount: 99,
        retryDelayMs: 0,
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'https://assets.test/openui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
      },
      () => {
        calls++;
        return Promise.resolve(
          evaluationResponse(
            {
              error: {
                message: calls === 1
                  ? 'first failure'
                  : 'second failure',
              },
            },
            { status: 503 },
          ),
        );
      },
    );

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      errors: ['ui-judge request returned HTTP 503: second failure'],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('stops an in-progress retry backoff when aborted', async () => {
    const controller = new AbortController();
    let calls = 0;
    const startedAt = performance.now();
    const resultPromise = runGenuiBenchUiJudge(
      {
        artifact: {
          protocol: 'openui',
          rawText: 'root = TextContent("Retry")',
        },
        attemptCount: 2,
        retryDelayMs: 30_000,
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'https://assets.test/openui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
        signal: controller.signal,
      },
      () => {
        calls++;
        setTimeout(() => controller.abort(), 0);
        return Promise.resolve(
          evaluationResponse(
            { error: { message: 'temporarily unavailable' } },
            { status: 503 },
          ),
        );
      },
    );

    const result = await resultPromise;

    expect(calls).toBe(1);
    expect(controller.signal.aborted).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
    expect(result).toMatchObject({
      errors: [
        'ui-judge request returned HTTP 503: temporarily unavailable',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('does not let generated OpenUI load arbitrary resources', async () => {
    let calls = 0;
    const result = await runGenuiBenchUiJudge(
      {
        artifact: {
          protocol: 'openui',
          rawText: 'root = Image("file:///etc/passwd", "untrusted local file")',
        },
        attemptCount: 2,
        retryDelayMs: 0,
        scenario: { prompt: 'Build an image card' },
        session: {
          bundleUrl: 'https://assets.test/openui.lynx.js',
          screenshotUrl: 'http://judge.test/screenshot/template',
        },
      },
      () => {
        calls++;
        return Promise.resolve(evaluationResponse({ score: 5 }));
      },
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      errors: [
        'ui-judge rejected OpenUI output containing an external resource URL or openUrl call.',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });
});
