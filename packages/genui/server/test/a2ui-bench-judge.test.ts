// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  probeBenchUiJudge,
  runBenchUiJudge,
  runBenchUiJudgeRequest,
} from '../service/a2ui-bench-judge.js';
import {
  BENCH_SCREENSHOT_DATA_URL_PREFIX,
  MAX_BENCH_SCREENSHOT_DECODED_BYTES,
} from '../service/a2ui-bench-screenshot.js';

function screenshotDataUrlForBytes(bytes: number): string {
  const encodedLength = Math.ceil(bytes / 3) * 4;
  const remainder = bytes % 3;
  let padding = '';
  if (remainder === 1) {
    padding = '==';
  } else if (remainder === 2) {
    padding = '=';
  }
  return BENCH_SCREENSHOT_DATA_URL_PREFIX
    + 'A'.repeat(encodedLength - padding.length)
    + padding;
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
    error?: { message: string };
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

describe('probeBenchUiJudge', () => {
  test('stays disabled without the private sidecar URL', async () => {
    let called = false;
    const capability = await probeBenchUiJudge({
      env: {},
      fetch: () => {
        called = true;
        throw new Error('unexpected fetch');
      },
    });

    expect(called).toBe(false);
    expect(capability).toEqual({
      enabled: false,
      reason: 'UI_JUDGE_SERVER_URL is not configured.',
    });
  });

  test('enables Judge after a successful health probe', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const capability = await probeBenchUiJudge({
      env: {
        UI_JUDGE_BUNDLE_URL: 'https://assets.test/a2ui.lynx.js',
        UI_JUDGE_SERVER_URL: 'http://judge.test/internal',
      },
      fetch: (input, init) => {
        requestUrl = input.toString();
        requestInit = init;
        return Promise.resolve(Response.json({ status: 'ok' }));
      },
    });

    expect(requestUrl).toBe('http://judge.test/internal/health');
    expect(requestInit?.method).toBe('GET');
    expect(capability).toEqual({
      enabled: true,
      session: {
        bundleUrl: 'https://assets.test/a2ui.lynx.js',
        judgeUrl: 'http://judge.test/internal/judge',
      },
    });
  });

  test('accepts a protocol-specific bundle override', async () => {
    const capability = await probeBenchUiJudge({
      bundleUrl: 'file:///tmp/openui.lynx.js',
      env: {
        UI_JUDGE_BUNDLE_URL: 'https://assets.test/a2ui.lynx.js',
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () => Promise.resolve(Response.json({ status: 'ok' })),
    });

    expect(capability).toEqual({
      enabled: true,
      session: {
        bundleUrl: 'file:///tmp/openui.lynx.js',
        judgeUrl: 'http://judge.test/judge',
      },
    });
  });

  test('keeps Judge disabled when the sidecar is not ready', async () => {
    const capability = await probeBenchUiJudge({
      env: {
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () =>
        Promise.resolve(
          Response.json(
            { error: { message: 'not ready' } },
            { status: 503 },
          ),
        ),
    });

    expect(capability).toEqual({
      enabled: false,
      reason: 'UI Judge health check returned HTTP 503.',
    });
  });
});

describe('runBenchUiJudge', () => {
  test('supports protocol-neutral global props', async () => {
    let requestBody: unknown;
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: {
          instant: true,
          rawText: 'root = TextContent("Hello")',
          theme: 'light',
        },
        scenario: {
          prompt: 'Build a greeting',
        },
        session: {
          bundleUrl: 'https://assets.test/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      (_input, init) => {
        const body = typeof init?.body === 'string' ? init.body : '';
        requestBody = JSON.parse(body) as unknown;
        return Promise.resolve(Response.json(geqiResponse(5)));
      },
    );

    expect(requestBody).toEqual({
      globalProps: {
        instant: true,
        rawText: 'root = TextContent("Hello")',
        theme: 'light',
      },
      includeGeqi: true,
      steps: [],
      task: 'Build a greeting',
      url: 'https://assets.test/openui.lynx.js',
    });
    expect(result).toEqual({
      dimensions: geqiResponse(5).dimensions,
      errors: [],
      geqiScore: 100,
      score: 5,
      status: 'complete',
      warnings: [],
    });
  });

  test('returns an explicitly requested captured PNG', async () => {
    let requestBody: unknown;
    const screenshotDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: { instant: true },
        includeScreenshot: true,
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      (_input, init) => {
        if (typeof init?.body !== 'string') {
          throw new Error('expected a JSON string request body');
        }
        requestBody = JSON.parse(init.body) as unknown;
        return Promise.resolve(
          Response.json({ ...geqiResponse(4), screenshotDataUrl }),
        );
      },
    );

    expect(requestBody).toMatchObject({ includeScreenshot: true });
    expect(result).toMatchObject({
      screenshotDataUrl,
      status: 'complete',
    });
  });

  test('discards a captured PNG larger than 2 MiB', async () => {
    const screenshotDataUrl = screenshotDataUrlForBytes(
      MAX_BENCH_SCREENSHOT_DECODED_BYTES + 1,
    );
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: { instant: true },
        includeScreenshot: true,
        scenario: { prompt: 'Build a greeting' },
        session: {
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () =>
        Promise.resolve(
          Response.json({ ...geqiResponse(4), screenshotDataUrl }),
        ),
    );

    expect(result).toEqual({
      dimensions: geqiResponse(4).dimensions,
      errors: [],
      geqiScore: 80,
      score: 4,
      status: 'complete',
      warnings: [
        'ui-judge returned an invalid screenshotDataUrl; the screenshot was discarded.',
      ],
    });
  });

  test('injects generated messages as server-owned global props', async () => {
    let requestUrl = '';
    let requestBody: unknown;
    const result = await runBenchUiJudge(
      {
        messages: [{
          version: 'v0.9',
          createSurface: {
            catalogId: 'catalog',
            surfaceId: 'surface',
          },
        }],
        scenario: {
          id: 'save',
          judgeSteps: ['Tap Save'],
          judgeTask: 'The saved state is visible',
          name: 'Save card',
          prompt: 'Build a save card',
          type: 'Action',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
        timeoutMs: 45_000,
      },
      (input, init) => {
        requestUrl = input.toString();
        if (typeof init?.body !== 'string') {
          throw new Error('expected a JSON string request body');
        }
        requestBody = JSON.parse(init.body) as unknown;
        return Promise.resolve(
          Response.json({
            ...geqiResponse(4),
            reason: 'The saved state is clear.',
            summary: 'Strong result.',
          }),
        );
      },
    );

    expect(requestUrl).toBe('http://judge.test/judge');
    expect(requestBody).toEqual({
      globalProps: {
        benchMode: true,
        instant: true,
        messages: [{
          version: 'v0.9',
          createSurface: {
            catalogId: 'catalog',
            surfaceId: 'surface',
          },
        }],
        speed: 0,
        theme: 'light',
      },
      includeGeqi: true,
      steps: ['Tap Save'],
      task: 'The saved state is visible',
      timeoutMs: 45_000,
      url: 'https://assets.test/a2ui.lynx.js',
    });
    expect(result).toEqual({
      dimensions: geqiResponse(4).dimensions,
      errors: [],
      geqiScore: 80,
      reason: 'The saved state is clear.',
      score: 4,
      status: 'complete',
      summary: 'Strong result.',
      warnings: [],
    });
  });

  test('marks a completed Judge failure as an unavailable score', async () => {
    const result = await runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'weather',
          name: 'Weather',
          prompt: 'Build a weather card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () =>
        Promise.resolve(
          Response.json({
            error: { message: 'capture failed' },
            score: 0,
          }),
        ),
    );

    expect(result).toEqual({
      errors: ['ui-judge failed: capture failed'],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('fails the whole Judge result when one GEQI dimension fails', async () => {
    const response = geqiResponse(4);
    response.dimensions[2] = {
      ...response.dimensions[2],
      error: { message: 'dimension request timed out' },
      score: 0,
    };
    response.geqiScore = 56 / 85 * 100;
    const result = await runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'weather',
          name: 'Weather',
          prompt: 'Build a weather card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => Promise.resolve(Response.json(response)),
    );

    expect(result).toEqual({
      errors: [
        'ui-judge consistency-standards failed: dimension request timed out',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('rejects inconsistent GEQI weights', async () => {
    const response = geqiResponse(4);
    response.dimensions[0] = {
      ...response.dimensions[0],
      weight: 29,
    };
    const result = await runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'weather',
          name: 'Weather',
          prompt: 'Build a weather card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => Promise.resolve(Response.json(response)),
    );

    expect(result.status).toBe('failed');
    expect(result.score).toBe(0);
    expect(result.dimensions).toBeUndefined();
    expect(result.geqiScore).toBeUndefined();
    expect(result.errors).toContain(
      'ui-judge returned invalid usability-interaction score metadata.',
    );
  });

  test('rejects an inconsistent GEQI aggregate', async () => {
    const response = geqiResponse(4);
    response.geqiScore = 79;
    const result = await runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'weather',
          name: 'Weather',
          prompt: 'Build a weather card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => Promise.resolve(Response.json(response)),
    );

    expect(result.status).toBe('failed');
    expect(result.score).toBe(0);
    expect(result.dimensions).toBeUndefined();
    expect(result.geqiScore).toBeUndefined();
    expect(result.errors).toContain(
      'ui-judge returned an inconsistent GEQI score: 79 vs 80.',
    );
  });

  test('maps non-success HTTP responses to run errors', async () => {
    const result = await runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'weather',
          name: 'Weather',
          prompt: 'Build a weather card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () =>
        Promise.resolve(
          Response.json(
            { error: { message: 'queue full' } },
            { status: 503 },
          ),
        ),
    );

    expect(result).toEqual({
      errors: ['ui-judge request returned HTTP 503: queue full'],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('replaces components that can load untrusted resources', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const result = await runBenchUiJudge(
      {
        messages: [{
          version: 'v0.9',
          updateComponents: {
            components: [
              {
                component: 'Image',
                id: 'image',
                url: 'file:///etc/passwd',
              },
              {
                component: 'LazyComponent',
                id: 'lazy',
                url: 'http://169.254.169.254/latest/meta-data',
              },
              {
                component: 'McpApp',
                id: 'mcp',
                mcpAppData: {},
                url: 'https://untrusted.test/app.lynx.js',
              },
              {
                component: 'Text',
                id: 'markdown',
                text: '![remote](http://127.0.0.1/image.png)',
                variant: 'markdown',
              },
              {
                component: 'LineChart',
                id: 'line-chart',
                labels: ['A', 'B'],
                series: [{
                  color: 'url(http://127.0.0.1/paint)',
                  name: 'unsafe',
                  values: [1, 2],
                }],
              },
              {
                component: 'PieChart',
                data: [{
                  color: 'url(file:///etc/passwd)',
                  name: 'unsafe',
                  value: 1,
                }],
                id: 'pie-chart',
              },
            ],
            surfaceId: 'surface',
          },
        }],
        scenario: {
          id: 'safe',
          name: 'Safe',
          prompt: 'Build a safe card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      (_input, init) => {
        if (typeof init?.body !== 'string') {
          throw new Error('expected a JSON string request body');
        }
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        return Promise.resolve(Response.json(geqiResponse(3)));
      },
    );

    const globalProps = requestBody?.globalProps as
      | Record<string, unknown>
      | undefined;
    const messages = globalProps?.messages as
      | Record<string, unknown>[]
      | undefined;
    const update = messages?.[0]?.updateComponents as
      | Record<string, unknown>
      | undefined;
    expect(update?.components).toEqual([
      { component: 'Loading', id: 'image', variant: 'block' },
      { component: 'Loading', id: 'lazy', variant: 'block' },
      { component: 'Loading', id: 'mcp', variant: 'block' },
      {
        component: 'Text',
        id: 'markdown',
        text: '![remote](http://127.0.0.1/image.png)',
        variant: 'body',
      },
      { component: 'Loading', id: 'line-chart', variant: 'block' },
      { component: 'Loading', id: 'pie-chart', variant: 'block' },
    ]);
    expect(result).toEqual({
      dimensions: geqiResponse(3).dimensions,
      errors: [],
      geqiScore: 60,
      score: 3,
      status: 'complete',
      warnings: [
        'ui-judge replaced 1 Image component to prevent untrusted resource loading.',
        'ui-judge replaced 1 LazyComponent component to prevent untrusted resource loading.',
        'ui-judge replaced 1 McpApp component to prevent untrusted resource loading.',
        'ui-judge replaced 1 markdown Text component to prevent untrusted resource loading.',
        'ui-judge replaced 1 LineChart component to prevent untrusted resource loading.',
        'ui-judge replaced 1 PieChart component to prevent untrusted resource loading.',
      ],
    });
  });

  test('rejects recursive openUrl calls before contacting the sidecar', async () => {
    let called = false;
    const result = await runBenchUiJudge(
      {
        messages: [{
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'surface',
            value: {
              nested: {
                args: { url: 'http://127.0.0.1/private' },
                call: 'openUrl',
                returnType: 'void',
              },
            },
          },
        }],
        scenario: {
          id: 'unsafe',
          name: 'Unsafe',
          prompt: 'Build a card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => {
        called = true;
        return Promise.resolve(Response.json({ score: 5 }));
      },
    );

    expect(called).toBe(false);
    expect(result).toEqual({
      errors: [
        'ui-judge rejected a model-generated openUrl function call to prevent server-side network access.',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });

  test('aborts an in-flight Judge request when the job is cancelled', async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    const resultPromise = runBenchUiJudge(
      {
        messages: [],
        scenario: {
          id: 'cancel',
          name: 'Cancel',
          prompt: 'Build a card',
          type: 'Information',
        },
        session: {
          bundleUrl: 'https://assets.test/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
        signal: controller.signal,
      },
      (_input, init) => {
        requestSignal = init?.signal;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new Error('request aborted')),
            { once: true },
          );
        });
      },
    );

    controller.abort();

    await expect(resultPromise).resolves.toEqual({
      errors: [],
      score: 0,
      status: 'failed',
      warnings: [],
    });
    expect(requestSignal?.aborted).toBe(true);
  });
});
