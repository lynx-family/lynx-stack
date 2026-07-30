// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  serializeBenchReport,
  shouldApplyBenchReportRequest,
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
});
