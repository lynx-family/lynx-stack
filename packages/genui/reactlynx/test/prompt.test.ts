// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { REACTLYNX_SYSTEM_PROMPT } from '../src/prompt.js';

test('describes the artifact and runtime boundaries', () => {
  expect(REACTLYNX_SYSTEM_PROMPT).toContain(
    '{"files":{"App.tsx":"...","App.css":"..."}}',
  );
  expect(REACTLYNX_SYSTEM_PROMPT).toContain(
    'Only import from @lynx-js/react',
  );
  expect(REACTLYNX_SYSTEM_PROMPT).toContain(
    'bindtap/catchtap for taps, not onClick',
  );
  expect(REACTLYNX_SYSTEM_PROMPT).toContain(
    'useLayoutEffect is unsupported',
  );
  expect(REACTLYNX_SYSTEM_PROMPT).toContain(
    'All text belongs inside text',
  );
});
