// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createBenchJobCancellationRequestInit,
  getBenchJobCancellationDisposition,
  getBenchRunBlockers,
  readBenchHistory,
  serializeBenchHistoryEntries,
  serializeBenchReport,
  shouldApplyBenchReportRequest,
  shouldCancelCreatedBenchJob,
} from '../BenchPage.js';
import { BenchRunnerPage } from './BenchRunnerPage.js';

// Rstest compiles standalone TSX imports with the classic JSX runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('BenchRunnerPage', () => {
  test('renders one composable runner instead of phase-specific recipes', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchRunnerPage),
    );

    expect(markup).toContain('Bench Runner');
    expect(markup).toContain(
      '在一份运行计划中自由组合 Protocol、Model、Prompt 与 Catalog。',
    );
    expect(markup).toContain('对比组');
    expect(markup).toContain('载入预设');
    expect(markup).toContain('A2UI');
    expect(markup).toContain('运行 Bench');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('Variant matrix');
    expect(markup).not.toContain('Protocol pair');
    expect(markup).not.toContain('Phase 01');
    expect(markup).not.toContain('Phase 02');
    expect(markup).not.toContain('A2UI Bench');
    expect(markup).not.toContain('phase-2-runner');
  });

  test('ignores stale and aborted report recovery requests', () => {
    const current = new AbortController();
    const stale = new AbortController();

    expect(shouldApplyBenchReportRequest(current, current)).toBe(true);
    expect(shouldApplyBenchReportRequest(stale, current)).toBe(false);

    current.abort();
    expect(shouldApplyBenchReportRequest(current, current)).toBe(false);
  });

  test('keeps failed job cancellations retryable', () => {
    expect(
      getBenchJobCancellationDisposition({ ok: true, status: 200 }),
    ).toBe('cleared');
    expect(
      getBenchJobCancellationDisposition({ ok: false, status: 404 }),
    ).toBe('cleared');
    expect(
      getBenchJobCancellationDisposition({ ok: false, status: 500 }),
    ).toBe('retry');
    expect(createBenchJobCancellationRequestInit()).toEqual({
      method: 'DELETE',
      keepalive: true,
    });
  });

  test('cancels a job created by a superseded start operation', () => {
    expect(shouldCancelCreatedBenchJob(4, 5)).toBe(true);
    expect(shouldCancelCreatedBenchJob(5, 5)).toBe(false);
  });

  test('requires an enabled control group before running', () => {
    expect(getBenchRunBlockers(1, 0, 1, 1)).toContain(
      '至少启用一个基准组。',
    );
    expect(getBenchRunBlockers(1, 1, 1, 1)).not.toContain(
      '至少启用一个基准组。',
    );
  });

  test('sanitizes provider details and screenshots from copied reports', () => {
    const serialized = serializeBenchReport({
      env: {
        baseURL: 'https://private-provider.example/v1',
        apiKey: 'secret',
      },
      provider: {
        baseUrl: 'https://alternate-private-provider.example/v1',
      },
      results: [
        {
          screenshotDataUrl: 'data:image/png;base64,private-image',
        },
      ],
      warning: 'retry https://private-provider.example/v1',
    } as never);

    expect(serialized).not.toContain('private-provider');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('private-image');
    expect(serialized).not.toContain('baseURL');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('screenshotDataUrl');
  });

  test('redacts the current provider key from report text', () => {
    const apiKey = 'custom/key+with?chars=42';
    const serialized = serializeBenchReport({
      warnings: [
        `provider rejected ${apiKey}`,
        `provider rejected ${encodeURIComponent(apiKey)}`,
      ],
      summaries: [],
      results: [],
    } as never, [apiKey]);

    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(encodeURIComponent(apiKey));
    expect(serialized).toContain('[redacted credential]');
  });

  test('migrates legacy history into a sanitized persistent shape', () => {
    const legacyHistory = [
      {
        id: 'legacy-entry',
        title: 'Legacy Run',
        savedAt: '2026-07-30T10:00:00.000Z',
        report: {
          id: 'legacy-report',
          createdAt: '2026-07-30T10:00:00.000Z',
          env: {
            apiKeyConfigured: true,
            apiKey: 'legacy-secret',
            baseURL: 'https://private-provider.example/v1',
            model: 'test-model',
          },
          settings: {
            repeats: 1,
            parallelism: 1,
            repairEnabled: true,
            judgeEnabled: true,
            collectLiveRenderMetrics: false,
          },
          groups: [],
          scenarios: [],
          summaries: [],
          results: [
            {
              error: 'Bearer legacy-token',
              screenshotDataUrl: 'data:image/png;base64,private-image',
            },
          ],
        },
        config: {
          env: {
            apiKeyConfigured: true,
            apiKey: 'legacy-secret',
            baseURL: 'https://private-provider.example/v1',
            model: 'test-model',
          },
          settings: {
            repeats: 1,
            parallelism: 1,
            repairEnabled: true,
            judgeEnabled: true,
            collectLiveRenderMetrics: false,
          },
          groups: [],
          scenarios: [],
        },
      },
    ];
    const originalWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    );
    let persisted = '';
    let serialized = '';
    let migratedLength = 0;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => JSON.stringify(legacyHistory),
          setItem: (_key: string, value: string) => {
            persisted = value;
          },
        },
      },
    });
    try {
      const migrated = readBenchHistory();
      migratedLength = migrated.length;
      serialized = serializeBenchHistoryEntries(migrated);
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }

    expect(migratedLength).toBe(1);
    expect(persisted).toBe(serialized);
    expect(serialized).not.toContain('legacy-secret');
    expect(serialized).not.toContain('private-provider');
    expect(serialized).not.toContain('legacy-token');
    expect(serialized).not.toContain('private-image');
    expect(serialized).not.toContain('"apiKey":');
    expect(serialized).not.toContain('baseURL');
    expect(serialized).not.toContain('screenshotDataUrl');
    expect(serialized).toContain('"apiKeyConfigured":true');
  });
});
