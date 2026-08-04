// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  probeGenuiBenchUiJudge,
  runGenuiBenchUiJudge,
} from '../service/genui-bench-judge.js';

describe('probeGenuiBenchUiJudge', () => {
  test('selects the OpenUI bundle independently', async () => {
    const capability = await probeGenuiBenchUiJudge('openui', {
      env: {
        UI_JUDGE_OPENUI_BUNDLE_URL: 'file:///tmp/openui.lynx.js',
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () =>
        Promise.resolve(
          Response.json({
            model: 'gpt-5.5-2026-04-24',
            status: 'ok',
          }),
        ),
    });

    expect(capability).toEqual({
      enabled: true,
      session: {
        bundleUrl: 'file:///tmp/openui.lynx.js',
        judgeUrl: 'http://judge.test/judge',
      },
    });
  });

  test('rejects a sidecar configured with a different judge model', async () => {
    const capability = await probeGenuiBenchUiJudge('a2ui', {
      env: {
        UI_JUDGE_SERVER_URL: 'http://judge.test',
      },
      fetch: () =>
        Promise.resolve(
          Response.json({ model: 'another-model', status: 'ok' }),
        ),
    });

    expect(capability).toEqual({
      enabled: false,
      reason:
        'UI Judge model mismatch: expected gpt-5.5-2026-04-24, received another-model.',
    });
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
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      (_input, init) => {
        const requestBody = typeof init?.body === 'string' ? init.body : '';
        body = JSON.parse(requestBody) as unknown;
        return Promise.resolve(Response.json({ score: 4 }));
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
      includeScreenshot: true,
      screenshotSettleMs: 1_000,
      steps: [],
      task: 'Build a greeting',
      url: 'file:///tmp/openui.lynx.js',
    });
    expect(result).toEqual({
      errors: [],
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
          bundleUrl: 'file:///tmp/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      (_input, init) => {
        const requestBody = typeof init?.body === 'string' ? init.body : '';
        body = JSON.parse(requestBody) as unknown;
        return Promise.resolve(Response.json({ score: 4 }));
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
      includeScreenshot: true,
      screenshotSettleMs: 1_000,
      steps: [],
      task: 'Build a greeting',
      url: 'file:///tmp/a2ui.lynx.js',
    });
    expect(result).toEqual({
      errors: [],
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
          bundleUrl: 'file:///tmp/a2ui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
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
            ? Response.json(
              { error: { message: 'temporarily unavailable' } },
              { status: 503 },
            )
            : Response.json({
              score: 5,
              screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
            }),
        );
      },
    );

    expect(calls).toBe(2);
    expect(requestUrls).toEqual([
      'http://judge.test/judge',
      'http://judge.test/judge',
    ]);
    expect(requestBodies[0]).toBe(requestBodies[1]);
    expect(result).toEqual({
      errors: [],
      score: 5,
      screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
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
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => {
        calls++;
        return Promise.resolve(
          Response.json(
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
    expect(result).toEqual({
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
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
        signal: controller.signal,
      },
      () => {
        calls++;
        setTimeout(() => controller.abort(), 0);
        return Promise.resolve(
          Response.json(
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
    expect(result).toEqual({
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
          bundleUrl: 'file:///tmp/openui.lynx.js',
          judgeUrl: 'http://judge.test/judge',
        },
      },
      () => {
        calls++;
        return Promise.resolve(Response.json({ score: 5 }));
      },
    );

    expect(calls).toBe(0);
    expect(result).toEqual({
      errors: [
        'ui-judge rejected OpenUI output containing an external resource URL or openUrl call.',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    });
  });
});
