// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createBenchJobCancellationRequestInit,
  getBenchGroupDisplayName,
  getBenchJobCancellationDisposition,
  getBenchRunBlockers,
  getBenchRunMessageText,
  getBenchScenarioDisplayName,
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

  test('renders the complete runner chrome in English', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchRunnerPage, { locale: 'en-US' }),
    );

    expect(markup).toContain(
      'Combine Protocol, Model, Prompt, and Catalog freely in one run plan.',
    );
    expect(markup).toContain('Comparison groups');
    expect(markup).toContain('Load preset');
    expect(markup).toContain('Run Bench');
    expect(markup).toContain('Run settings');
    expect(markup).toContain('Shared scenarios');
    expect(markup).toContain('Waiting for Bench data');
    expect(markup).not.toContain('对比组');
    expect(markup).not.toContain('运行设置');
    expect(markup).not.toMatch(/[\u3400-\u9fff]/u);
  });

  test('re-renders system state for a zh-CN to en-US locale switch', () => {
    const message = { code: 'preset-loaded' } as const;
    const group = {
      name: '默认 Prompt',
      systemName: 'default-prompt',
    } as const;
    const scenario = {
      name: '自定义场景',
      systemName: 'custom-scenario',
    } as const;

    expect(getBenchRunMessageText(message, 'zh-CN')).toBe('已载入预设');
    expect(getBenchRunMessageText(message, 'en-US')).toBe('Preset loaded');
    expect(getBenchGroupDisplayName(group, 'zh-CN')).toBe('默认 Prompt');
    expect(getBenchGroupDisplayName(group, 'en-US')).toBe('Default Prompt');
    expect(getBenchScenarioDisplayName(scenario, 'zh-CN')).toBe('自定义场景');
    expect(getBenchScenarioDisplayName(scenario, 'en-US')).toBe(
      'Custom scenario',
    );

    const userText = { code: 'raw', text: '用户自定义状态' } as const;
    const customGroup = { name: '我的实验组' };
    const customScenario = { name: '我的场景' };
    expect(getBenchRunMessageText(userText, 'en-US')).toBe('用户自定义状态');
    expect(getBenchGroupDisplayName(customGroup, 'en-US')).toBe('我的实验组');
    expect(getBenchScenarioDisplayName(customScenario, 'en-US')).toBe(
      '我的场景',
    );
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
    expect(getBenchRunBlockers(1, 0, 1, 1, 'en-US')).toContain(
      'Enable at least one baseline group.',
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
