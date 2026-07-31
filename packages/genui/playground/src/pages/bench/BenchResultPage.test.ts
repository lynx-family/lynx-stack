// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BenchResultPage } from './BenchResultPage.js';

// Rstest compiles standalone TSX imports with the classic JSX runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('BenchResultPage', () => {
  test('keeps Chinese as the default locale', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchResultPage),
    );

    expect(markup).toContain('lang="zh-CN"');
    expect(markup).toContain('一期测评结果');
    expect(markup).toContain('关键结果');
    expect(markup).toContain('实验对比');
    expect(markup).toContain('gpt-5.5-2026-04-24');
  });

  test('renders English chrome and report copy without Chinese chrome', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchResultPage, { locale: 'en-US' }),
    );

    expect(markup).toContain('lang="en-US"');
    expect(markup).toContain('Phase 1 benchmark results');
    expect(markup).toContain('Key results');
    expect(markup).toContain('Experiment comparison');
    expect(markup).toContain('Weather refresh card');
    expect(markup).toContain('Before reading the results');
    expect(markup).toContain('gpt-5.5-2026-04-24');
    expect(markup).toContain('href="#/bench/phase-2"');
    expect(markup).not.toContain('一期结论');
    expect(markup).not.toContain('关键结果');
    expect(markup).not.toContain('实验对比');
    expect(markup).not.toContain('测试场景');
    expect(markup).not.toMatch(/[\u3400-\u9fff]/u);
  });
});
