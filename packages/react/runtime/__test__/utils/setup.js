// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { __injectElementApi } from './inject.ts';
import '../../src/lynx.ts';
import { document } from '../../src/document.ts';

import { afterEach, expect } from 'vitest';

function inject() {
  __injectElementApi();
  // __injectGlobals();

  globalThis.document = document;
}

inject();

afterEach((context) => {
  if (context.task.name.includes('preact/debug')) {
    // Skip preact/debug tests since there would be error
    return;
  }

  // check profile call times equal end call times
  expect(console.profile.mock.calls.length).toBe(
    console.profileEnd.mock.calls.length,
  );
});
