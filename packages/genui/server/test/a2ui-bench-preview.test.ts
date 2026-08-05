// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';
import type { Browser, Page, Route } from 'playwright-core';

import type { BenchPreviewDependencies } from '../service/a2ui-bench-preview.js';
import {
  buildBenchPreviewUrls,
  runBenchPreview,
} from '../service/a2ui-bench-preview.js';
import type { BenchJobRequest } from '../service/a2ui-bench-types.js';

const request: BenchJobRequest = {
  provider: {
    apiKey: 'test-key',
    baseURL: 'https://api.openai.com/v1',
    model: 'test-model',
  },
  playground: {
    baseUrl: 'http://127.0.0.1:3000/',
  },
  settings: {
    judgeEnabled: true,
    maxRepairAttempts: 1,
    parallelism: 1,
    renderMetricsEnabled: true,
    repairEnabled: true,
    repeats: 1,
  },
  groups: [],
  scenarios: [],
};

const scenario = {
  id: 'hangzhou',
  name: 'Hangzhou trip',
  prompt: 'Create a five-day Hangzhou itinerary.',
  type: 'Travel',
};

function createPreviewHarness() {
  let evaluateInput: Record<string, unknown> | undefined;
  let fulfilled: Record<string, unknown> | undefined;
  let routeUrl = '';
  const page = {
    close: () => Promise.resolve(),
    evaluate: (
      _fn: unknown,
      input: Record<string, unknown>,
    ) => {
      evaluateInput = input;
      return Promise.resolve({
        fmp: 123.4,
        render: 45.6,
        tti: 234.5,
      });
    },
    route: async (
      url: string,
      handler: (route: Route) => Promise<void>,
    ) => {
      routeUrl = url;
      await handler({
        fulfill: (options: Record<string, unknown>) => {
          fulfilled = options;
          return Promise.resolve();
        },
      } as unknown as Route);
    },
    screenshot: () => Promise.resolve(Buffer.from('jpeg')),
    setContent: () => Promise.resolve(),
    setDefaultTimeout: () => undefined,
    waitForTimeout: () => Promise.resolve(),
  } as unknown as Page;
  const browser = {
    isConnected: () => true,
    newPage: () => Promise.resolve(page),
  } as unknown as Browser;
  const judgeCalls: Record<string, unknown>[] = [];
  const dependencies: BenchPreviewDependencies = {
    getBrowser: () => Promise.resolve(browser),
    judgeScreenshot: (options) => {
      judgeCalls.push(options as unknown as Record<string, unknown>);
      return Promise.resolve({
        reason: 'The requested content is visible.',
        score: 4,
        summary: 'Good visual result.',
      });
    },
  };

  return {
    dependencies,
    getEvaluateInput: () => evaluateInput,
    getFulfilled: () => fulfilled,
    getRouteUrl: () => routeUrl,
    judgeCalls,
  };
}

describe('bench previews', () => {
  test('renders and judges A2UI messages', async () => {
    const harness = createPreviewHarness();
    const result = await runBenchPreview(
      {
        messages: [{ beginRendering: { root: 'root' } }] as never,
        protocol: 'a2ui',
        request,
        runId: 'a2ui-run',
        scenario,
      },
      harness.dependencies,
    );

    expect(result).toMatchObject({
      errors: [],
      fmpMs: 123,
      judgeScore: 4,
      judgeSummary: 'Good visual result.',
      renderMs: 46,
      ttiMs: 235,
    });
    expect(result.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/u);
    expect(harness.getEvaluateInput()?.protocol).toBe('a2ui');
    expect(harness.getRouteUrl()).toBe('');
    expect(harness.judgeCalls).toHaveLength(1);
    expect(harness.judgeCalls[0]).not.toHaveProperty('protocol');
  });

  test('inlines generated OpenUI into the Web preview and judges it', async () => {
    const harness = createPreviewHarness();
    const source =
      'root = Stack([TextContent("Hangzhou", "large-heavy")], "column")';
    const result = await runBenchPreview(
      {
        protocol: 'openui',
        request,
        runId: 'openui-run',
        scenario,
        source,
      },
      harness.dependencies,
    );

    expect(result.judgeScore).toBe(4);
    expect(harness.getEvaluateInput()?.protocol).toBe('openui');
    expect(harness.getRouteUrl()).toBe('');
    expect(harness.getFulfilled()).toBeUndefined();
    expect(harness.judgeCalls).toHaveLength(1);
    expect(harness.judgeCalls[0]).not.toHaveProperty('protocol');
  });

  test('routes generated Lynx XML into the Web preview and judges it', async () => {
    const harness = createPreviewHarness();
    const source = '<!DOCTYPE lynx><script main-thread></script>';
    const result = await runBenchPreview(
      {
        protocol: 'lynx-xml',
        request,
        runId: 'xml-run',
        scenario,
        source,
      },
      harness.dependencies,
    );

    expect(result.judgeScore).toBe(4);
    expect(harness.getEvaluateInput()?.protocol).toBe('lynx-xml');
    expect(harness.getRouteUrl()).toContain(
      '/__bench-lynx-xml/xml-run/artifact.xml',
    );
    expect(harness.getFulfilled()).toMatchObject({
      body: source,
      contentType: 'application/xml; charset=utf-8',
      status: 200,
    });
    expect(harness.judgeCalls).toHaveLength(1);
    expect(harness.judgeCalls[0]).not.toHaveProperty('protocol');
  });

  test('builds an OpenUI render URL with inline source', () => {
    const source =
      'root = Column([Text("Hangzhou", "h2")], "start", "stretch", "m")';
    const urls = buildBenchPreviewUrls({
      protocol: 'openui',
      request,
      runId: 'group/one',
      source,
    });
    const renderUrl = new URL(urls.renderUrl);

    expect(renderUrl.searchParams.get('protocol')).toBe('openui');
    expect(renderUrl.searchParams.get('demoUrl')).toBe('./openui.web.js');
    expect(renderUrl.searchParams.get('rawText')).toBe(source);
    expect(renderUrl.searchParams.has('rawTextUrl')).toBe(false);
    expect(urls.sourceUrl).toBeUndefined();
  });

  test('builds an XML render URL that points at the intercepted artifact', () => {
    const urls = buildBenchPreviewUrls({
      protocol: 'lynx-xml',
      request,
      runId: 'group/one',
    });
    const renderUrl = new URL(urls.renderUrl);

    expect(renderUrl.searchParams.get('protocol')).toBe('lynx-xml');
    expect(renderUrl.searchParams.get('demoUrl')).toBe(urls.sourceUrl);
    expect(urls.sourceUrl).toContain('group%2Fone');
  });
});
