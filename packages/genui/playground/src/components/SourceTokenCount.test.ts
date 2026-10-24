// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { SourceTokenCount } from './SourceTokenCount.js';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  rstest.stubGlobal('React', React);
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  rstest.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  rstest.useRealTimers();
  rstest.unstubAllGlobals();
});

async function render(source: string) {
  await React.act(async () =>
    root.render(React.createElement(SourceTokenCount, { source }))
  );
}

test('counts exact code, Unicode, whitespace, and special-token spellings with o200k_base', async () => {
  const source = '\n<text>杭州天气 ☀️ <|endoftext|></text>\n  ';
  await render(source);
  expect(container.textContent).toBe('Counting tokens…');
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy'))
    .toBe('true');
  await React.act(async () => rstest.advanceTimersByTimeAsync(250));
  expect(container.textContent).toBe(
    `${countTokens(source, { disallowedSpecial: new Set() })} tokens`,
  );
  expect(container.textContent).not.toBe(`${source.length} tokens`);
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy'))
    .toBe('false');
});

test('recounts changed views without showing stale counts and cancels intermediate updates', async () => {
  await render('Hello world');
  await React.act(async () => rstest.advanceTimersByTimeAsync(250));
  expect(container.textContent).toBe('2 tokens');
  await render('Intermediate source');
  expect(container.textContent).toBe('Counting tokens…');
  await React.act(async () => rstest.advanceTimersByTimeAsync(100));
  const source = JSON.stringify({ text: 'Final source' }, null, 2);
  await render(source);
  await React.act(async () => rstest.advanceTimersByTimeAsync(150));
  expect(container.textContent).toBe('Counting tokens…');
  await React.act(async () => rstest.advanceTimersByTimeAsync(100));
  expect(container.textContent).toBe(`${countTokens(source)} tokens`);
  await render('');
  expect(container.textContent).toBe('0 tokens');
});
