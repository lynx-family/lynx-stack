// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  probeBenchUiJudge,
  runBenchUiJudge,
} from '../service/a2ui-bench-judge.js';

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
            reason: 'The saved state is clear.',
            score: 4,
            summary: 'Strong result.',
          }),
        );
      },
    );

    expect(requestUrl).toBe('http://judge.test/judge');
    expect(requestBody).toEqual({
      globalProps: {
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
      steps: ['Tap Save'],
      task: 'The saved state is visible',
      timeoutMs: 45_000,
      url: 'https://assets.test/a2ui.lynx.js',
    });
    expect(result).toEqual({
      errors: [],
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
        return Promise.resolve(Response.json({ score: 3 }));
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
      errors: [],
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
