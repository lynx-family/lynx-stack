// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import { Stack } from '../src/catalog/Stack/index.jsx';
import { GAP_CLASS } from '../src/catalog/utils.js';
import { buildOpenUiSystemPrompt } from '../src/openui-prompt/index.js';

test('accepts and maps the xxs Stack gap class', () => {
  expect(Stack.props.safeParse({ children: [], gap: 'xxs' }).success).toBe(
    true,
  );
  expect(GAP_CLASS.xxs).toBe('OpenUIGapXxs');
});

test('accepts and maps the 2xl Stack gap class', () => {
  expect(Stack.props.safeParse({ children: [], gap: '2xl' }).success).toBe(
    true,
  );
  expect(GAP_CLASS['2xl']).toBe('OpenUIGap2Xl');
});

test('includes the extended gap scale in the OpenUI prompt', () => {
  const prompt = buildOpenUiSystemPrompt({ componentNames: ['Stack'] });

  expect(prompt).toContain(
    'gap?: "none" | "xxs" | "xs" | "s" | "m" | "l" | "xl" | "2xl"',
  );
});
