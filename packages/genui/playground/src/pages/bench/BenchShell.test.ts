// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BenchShell } from './BenchShell.js';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const noop = () => undefined;

describe('BenchShell', () => {
  test('renders a persistent bilingual language control', () => {
    const chinese = renderToStaticMarkup(
      React.createElement(
        BenchShell,
        {
          activeSlug: 'runner',
          locale: 'zh-CN',
          theme: 'light',
          onChangeLocale: noop,
          onToggleTheme: noop,
        },
        React.createElement('span', null, 'Content'),
      ),
    );
    const english = renderToStaticMarkup(
      React.createElement(
        BenchShell,
        {
          activeSlug: 'phase-1',
          locale: 'en-US',
          theme: 'dark',
          onChangeLocale: noop,
          onToggleTheme: noop,
        },
        React.createElement('span', null, 'Content'),
      ),
    );

    expect(chinese).toContain('lang="zh-CN"');
    expect(chinese).toContain('aria-label="语言"');
    expect(chinese).toContain('aria-pressed="true"');
    expect(chinese).toContain('中文');
    expect(chinese).toContain('EN');

    expect(english).toContain('lang="en"');
    expect(english).toContain('aria-label="Language"');
    expect(english).toContain('Switch to light mode');
  });
});
