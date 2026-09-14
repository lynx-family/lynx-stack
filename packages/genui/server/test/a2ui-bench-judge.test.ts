// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';
import { PNG } from 'pngjs';

import { readScreenshotForm } from './helpers/screenshot-form.js';
import type { ScreenshotEvaluation } from '../agent/common/ui-judge-agent.js';
import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import * as actualJudge from '../agent/common/ui-judge-agent.js' with {
  rstest: 'importActual',
};
import {
  resolveBenchUiJudge,
  runBenchUiJudge,
  runBenchUiJudgeRequest,
} from '../service/a2ui/a2ui-bench-judge.js';
import { BenchTaskPool } from '../service/common/bench/concurrency.js';
import {
  BENCH_SCREENSHOT_DATA_URL_PREFIX,
  MAX_BENCH_SCREENSHOT_DECODED_BYTES,
  readBenchScreenshotDataUrl,
} from '../service/common/bench/screenshot.js';

rstest.mock('../agent/common/ui-judge-agent.js', () => ({
  ...actualJudge,
  evaluateScreenshot: rstest.fn(),
}));

// A runner-format 2x2 BMP: red, translucent green, transparent blue, and RGB(20,40,60).
const CAPTURED_BMP = Buffer.from(
  'Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AP8AgP8AAAA8KBT/',
  'base64',
);

function bmpDataUrl(bmp: Buffer): string {
  return 'data:image/bmp;base64,' + bmp.toString('base64');
}

function largeBmp(): Buffer {
  const bmp = Buffer.alloc(122 + 1024 * 768 * 4, 255);
  CAPTURED_BMP.copy(bmp, 0, 0, 122);
  bmp.writeUInt32LE(bmp.length, 2);
  bmp.writeInt32LE(1024, 18);
  bmp.writeInt32LE(-768, 22);
  bmp.writeUInt32LE(bmp.length - 122, 34);
  return bmp;
}

describe('BMP screenshot conversion', () => {
  test('applies the screenshot limit after PNG compression', async () => {
    const bmp = largeBmp();
    expect(bmp.length).toBeGreaterThan(MAX_BENCH_SCREENSHOT_DECODED_BYTES);
    const result = await readBenchScreenshotDataUrl(bmpDataUrl(bmp));
    expect(result).toBeDefined();
    const png = PNG.sync.read(Buffer.from(result!.split(',')[1]!, 'base64'));
    expect([png.width, png.height]).toEqual([1024, 768]);
    expect(png.data.every((byte) => byte === 255)).toBe(true);
  });

  test('discards PNG output larger than the report limit', async () => {
    const bmp = largeBmp();
    // Deterministic noise is incompressible and exercises the output limit.
    let state = 42;
    for (let i = 122; i < bmp.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      bmp[i] = state & 255;
    }
    expect(await readBenchScreenshotDataUrl(bmpDataUrl(bmp))).toBeUndefined();
  });

  test('rejects truncated pixels, unsupported masks, and excessive dimensions', async () => {
    const wrongMask = Buffer.from(CAPTURED_BMP);
    wrongMask.writeUInt32LE(0, 66);
    const huge = Buffer.from(CAPTURED_BMP);
    huge.writeInt32LE(0x7fffffff, 18);
    for (const bmp of [CAPTURED_BMP.subarray(0, 130), wrongMask, huge]) {
      expect(await readBenchScreenshotDataUrl(bmpDataUrl(bmp))).toBeUndefined();
    }
    expect(await readBenchScreenshotDataUrl('data:image/bmp;base64,!!!!'))
      .toBeUndefined();
  });
});

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

test('excludes capture and scoring queue waits from the execution timeout', async () => {
  const scheduling = {
    evaluation: new BenchTaskPool(1),
  };
  let startCapture!: () => void;
  const started = new Promise<void>((resolve) => {
    startCapture = resolve;
  });
  const queueEvaluation = rstest.spyOn(scheduling.evaluation, 'run');
  const releaseEvaluation = await scheduling.evaluation.acquire();
  let now = 0;
  const clock = rstest.spyOn(performance, 'now').mockImplementation(() => now);
  const timeout = rstest.spyOn(AbortSignal, 'timeout');
  const capture = rstest.fn(() => ({
    started,
    response: Promise.resolve(evaluationResponse(geqiResponse(4))),
  }));
  const running = runBenchUiJudgeRequest({
    globalProps: {},
    scenario: { prompt: 'Build a card' },
    session: {
      screenshotPath: 'screenshot/zip/url',
      zipUrl: 'https://assets.test/app.zip',
    },
    timeoutMs: 1_000,
    scheduling,
  }, capture);
  try {
    expect(capture).toHaveBeenCalledTimes(1);
    expect(timeout).not.toHaveBeenCalled();
    now = 10_000;
    startCapture();
    await rstest.waitUntil(() => queueEvaluation.mock.calls.length === 1);
    now = 20_000;
    releaseEvaluation();
    const result = await running;
    expect(result.status).toBe('complete');
    expect(timeout.mock.calls).toEqual([[2_000], [2_000]]);
  } finally {
    startCapture();
    releaseEvaluation();
    clock.mockRestore();
    timeout.mockRestore();
    queueEvaluation.mockRestore();
  }
});

describe('resolveBenchUiJudge', () => {
  test('resolves capture inputs without using a screenshot service URL', async () => {
    expect(
      await resolveBenchUiJudge({
        env: {
          UI_JUDGE_SERVER_URL: 'file:///unreachable',
          UI_JUDGE_ZIP_URL: 'https://assets.test/a2ui.lynx.zip',
        },
      }),
    ).toEqual({
      enabled: true,
      session: {
        zipUrl: 'https://assets.test/a2ui.lynx.zip',
        screenshotPath: 'screenshot/zip/url',
      },
    });
  });
  test('accepts a protocol-specific bundle override without environment configuration', async () => {
    expect(
      await resolveBenchUiJudge({
        env: {},
        zipUrl: 'https://assets.test/openui.lynx.zip',
      }),
    )
      .toEqual({
        enabled: true,
        session: {
          zipUrl: 'https://assets.test/openui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      });
  });
  test('rejects an invalid bundle URL', async () => {
    expect(
      await resolveBenchUiJudge({ env: {}, zipUrl: 'file:///template.js' }),
    ).toMatchObject({ enabled: false });
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
          zipUrl: 'https://assets.test/openui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      (request) => {
        requestBody = readScreenshotForm(request);
        return Promise.resolve(evaluationResponse(geqiResponse(5)));
      },
    );

    expect(requestBody).toEqual({
      entry: 'template.js',
      width: 390,
      height: 844,
      globalProps: {
        instant: true,
        rawText: 'root = TextContent("Hello")',
        theme: 'light',
      },
      url: 'https://assets.test/openui.lynx.zip',
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

  test('converts Judge BMP responses to PNG without changing RGBA pixels', async () => {
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: { instant: true },
        includeScreenshot: true,
        scenario: { prompt: 'Build a greeting' },
        session: {
          zipUrl: 'https://assets.test/openui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () =>
        Promise.resolve(evaluationResponse({
          ...geqiResponse(4),
        })),
    );
    expect(result.status).toBe('complete');
    expect(result.warnings).toEqual([]);
    expect(
      result.screenshotDataUrl?.startsWith(BENCH_SCREENSHOT_DATA_URL_PREFIX),
    )
      .toBe(true);
    const png = PNG.sync.read(
      Buffer.from(result.screenshotDataUrl!.split(',')[1]!, 'base64'),
    );
    expect([png.width, png.height]).toEqual([2, 2]);
    expect([...png.data]).toEqual([
      255,
      0,
      0,
      255,
      0,
      255,
      0,
      128,
      0,
      0,
      255,
      0,
      20,
      40,
      60,
      255,
    ]);
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
          judgeTask: 'The saved state is visible',
          name: 'Save card',
          prompt: 'Build a save card',
          type: 'Action',
        },
        session: {
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
        timeoutMs: 45_000,
      },
      (request) => {
        requestUrl = request.path;
        requestBody = readScreenshotForm(request);
        return Promise.resolve(
          evaluationResponse({
            ...geqiResponse(4),
            reason: 'The saved state is clear.',
            summary: 'Strong result.',
          }),
        );
      },
    );

    expect(requestUrl).toBe('screenshot/zip/url');
    expect(requestBody).toEqual({
      entry: 'template.js',
      width: 390,
      height: 844,
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
      url: 'https://assets.test/a2ui.lynx.zip',
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () =>
        Promise.resolve(
          evaluationResponse({
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () => Promise.resolve(evaluationResponse(response)),
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () => Promise.resolve(evaluationResponse(response)),
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () => Promise.resolve(evaluationResponse(response)),
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () =>
        Promise.resolve(
          evaluationResponse(
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
                url: 'https://untrusted.test/app.lynx.zip',
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      (request) => {
        requestBody = readScreenshotForm(request);
        return Promise.resolve(evaluationResponse(geqiResponse(3)));
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
      },
      () => {
        called = true;
        return Promise.resolve(evaluationResponse({ score: 5 }));
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
          zipUrl: 'https://assets.test/a2ui.lynx.zip',
          screenshotPath: 'screenshot/zip/url',
        },
        signal: controller.signal,
      },
      (_request, signal) => {
        requestSignal = signal;
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

describe('screenshot evaluation boundary', () => {
  const session = {
    zipUrl: 'https://assets.test/a2ui.lynx.zip',
    screenshotPath: 'screenshot/zip/url' as const,
  };

  test('keeps task and model in GenUI and sends the same converted PNG to scoring and the report', async () => {
    let body: unknown;
    const result = await runBenchUiJudge({
      messages: [],
      includeScreenshot: true,
      model: 'Selected',
      scenario: { prompt: 'Build a greeting', judgeTask: 'Show the greeting' },
      session,
    }, (request) => {
      body = readScreenshotForm(request);
      return Promise.resolve(evaluationResponse(geqiResponse(4)));
    });
    expect(body).toEqual({
      entry: 'template.js',
      width: 390,
      height: 844,
      url: session.zipUrl,
      globalProps: {
        benchMode: true,
        instant: true,
        messages: [],
        speed: 0,
        theme: 'light',
      },
    });
    expect(evaluateScreenshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: 'Selected',
        task: 'Show the greeting',
        screenshotDataUrl: result.screenshotDataUrl,
      }),
    );
    expect(result.screenshotDataUrl).toMatch(/^data:image\/png;base64,/u);
  });

  test('rejects interaction steps before calling the capture service or model', async () => {
    const fetch = rstest.fn();
    const evaluate = rstest.fn();
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: {},
        scenario: { prompt: 'Save', judgeSteps: ['Tap Save'] },
        session,
      },
      fetch,
      evaluate,
    );
    expect(result.status).toBe('failed');
    expect(fetch).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  test('scores a PNG beyond the report storage limit without persisting it', async () => {
    const bmp = largeBmp();
    let state = 42;
    for (let i = 122; i < bmp.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      bmp[i] = state & 255;
    }
    const evaluate = rstest.fn(
      (request: { screenshotDataUrl: string }) => {
        expect(
          Buffer.from(request.screenshotDataUrl.split(',')[1]!, 'base64')
            .length,
        ).toBeGreaterThan(MAX_BENCH_SCREENSHOT_DECODED_BYTES);
        return Promise.resolve(geqiResponse(4) as ScreenshotEvaluation);
      },
    );
    const result = await runBenchUiJudgeRequest(
      {
        globalProps: {},
        includeScreenshot: true,
        scenario: { prompt: 'Build a greeting' },
        session,
      },
      () =>
        Promise.resolve(
          new Response(new Uint8Array(bmp), {
            headers: { 'Content-Type': 'image/bmp' },
          }),
        ),
      evaluate,
    );
    expect(result).toMatchObject({
      status: 'complete',
      score: 4,
      geqiScore: 80,
    });
    expect(result.screenshotDataUrl).toBeUndefined();
    expect(result.warnings).toEqual([
      'The captured PNG exceeded the Bench screenshot storage limit.',
    ]);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  test('rejects malformed BMP responses before evaluation', async () => {
    const evaluate = rstest.fn();
    const result = await runBenchUiJudgeRequest(
      { globalProps: {}, scenario: { prompt: 'Build a greeting' }, session },
      () =>
        Promise.resolve(
          new Response('broken', { headers: { 'Content-Type': 'image/bmp' } }),
        ),
      evaluate,
    );
    expect(result.status).toBe('failed');
    expect(evaluate).not.toHaveBeenCalled();
  });

  for (
    const [reason, headers] of [
      ['an unexpected content type', { 'Content-Type': 'image/png' }],
      ['an oversized content length', {
        'Content-Type': 'image/bmp',
        'Content-Length': String(10 * 1024 * 1024 + 1025),
      }],
    ] as const
  ) {
    test(`cancels the unread body for ${reason}`, async () => {
      for (const rejectCancellation of [false, true]) {
        const cancel = rstest.fn(() =>
          rejectCancellation
            ? Promise.reject(new Error('Cleanup failed.'))
            : Promise.resolve()
        );
        const pull = rstest.fn();
        const evaluate = rstest.fn();
        const response = new Response(
          new ReadableStream({ cancel, pull }, { highWaterMark: 0 }),
          { headers },
        );
        const result = await runBenchUiJudgeRequest(
          {
            globalProps: {},
            scenario: { prompt: 'Build a greeting' },
            session,
          },
          () => Promise.resolve(response),
          evaluate,
        );

        expect(result).toMatchObject({
          status: 'failed',
          score: 0,
          errors: [
            expect.stringContaining('GenUI screenshot evaluation failed:'),
          ],
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(pull).not.toHaveBeenCalled();
        expect(response.bodyUsed).toBe(true);
        expect(evaluate).not.toHaveBeenCalled();
      }
    });

    test(`rejects ${reason} when the response body is absent`, async () => {
      const evaluate = rstest.fn();
      const result = await runBenchUiJudgeRequest(
        { globalProps: {}, scenario: { prompt: 'Build a greeting' }, session },
        () => Promise.resolve(new Response(null, { headers })),
        evaluate,
      );
      expect(result).toMatchObject({
        status: 'failed',
        score: 0,
        errors: [
          expect.stringContaining('GenUI screenshot evaluation failed:'),
        ],
      });
      expect(evaluate).not.toHaveBeenCalled();
    });
  }

  test('cancels a stalled screenshot body without starting the model', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const evaluate = rstest.fn();
    const pending = runBenchUiJudgeRequest({
      globalProps: {},
      scenario: { prompt: 'Build a greeting' },
      session,
      signal: controller.signal,
    }, () => {
      setTimeout(() => controller.abort(), 0);
      return Promise.resolve(
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { 'Content-Type': 'image/bmp' } },
        ),
      );
    }, evaluate);
    expect(await pending).toMatchObject({ status: 'failed', errors: [] });
    expect(cancelled).toBe(true);
    expect(evaluate).not.toHaveBeenCalled();
  });
});

test.each([
  { viewport: undefined, width: 390, height: 844 },
  { viewport: {}, width: 390, height: 844 },
  { viewport: { width: 375 }, width: 375, height: 844 },
  { viewport: { height: 812 }, width: 390, height: 812 },
])(
  'fills missing viewport dimensions for $viewport',
  async ({ viewport, width, height }) => {
    for (const xml of [false, true]) {
      await runBenchUiJudgeRequest({
        globalProps: {},
        ...(xml ? { lynxXmlSource: '<lynx/>' } : {}),
        ...(viewport ? { viewport } : {}),
        scenario: { prompt: 'Greeting' },
        session: {
          screenshotPath: `screenshot/zip/${xml ? 'upload' : 'url'}`,
          ...(xml ? {} : { zipUrl: 'https://assets.test/a2ui.lynx.zip' }),
        },
      }, (request) => {
        expect(readScreenshotForm(request)).toMatchObject({ width, height });
        return Promise.resolve(evaluationResponse(geqiResponse(4)));
      });
    }
  },
);

test.each(['a2ui', 'openui', 'lynx-xml'])(
  'passes supported ZIP fields and keeps timeout client-side for %s',
  async (protocol) => {
    const xml = protocol === 'lynx-xml';
    await runBenchUiJudgeRequest({
      globalProps: { ready: true },
      ...(xml ? { lynxXmlSource: '<lynx/>' } : {}),
      initData: { count: 1 },
      viewport: { width: 375, height: 812 },
      timeoutMs: 4321,
      scenario: { prompt: 'Greeting' },
      session: {
        screenshotPath: `screenshot/zip/${xml ? 'upload' : 'url'}`,
        ...(xml
          ? {}
          : { zipUrl: `https://assets.test/${protocol}.lynx.zip` }),
      },
    }, (request) => {
      expect(request.source).toBe(xml ? '<lynx/>' : undefined);
      expect(request.timeoutMs).toBe(8642);
      expect(readScreenshotForm(request)).toEqual({
        entry: xml ? 'index.lynxml' : 'template.js',
        ...(xml
          ? {}
          : {
            url: `https://assets.test/${protocol}.lynx.zip`,
            globalProps: { ready: true },
          }),
        initData: { count: 1 },
        width: 375,
        height: 812,
      });
      return Promise.resolve(evaluationResponse(geqiResponse(4)));
    });
  },
);
