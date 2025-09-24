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

expect.addSnapshotSerializer({
  test(val) {
    return Boolean(
      val
        && typeof val === 'object'
        && Array.isArray(val.refAttr)
        && Object.prototype.hasOwnProperty.call(val, 'task')
        && typeof val.exec === 'function',
    );
  },
  print(val, serialize) {
    const printed = serialize({
      refAttr: Array.isArray(val.refAttr) ? [...val.refAttr] : val.refAttr,
      task: val.task,
    });
    if (printed.startsWith('Object')) {
      return printed.replace(/^Object/, 'RefProxy');
    }
    if (printed.startsWith('{')) {
      return `RefProxy ${printed}`;
    }
    return printed;
  },
});

afterEach((context) => {
  const skippedTasks = [
    // Skip preact/debug tests since it would throw errors and abort the rendering process
    'preact/debug',
    'should remove event listener when throw in cleanup',
    'should not throw if error - instead it will render an empty page',
  ];
  if (skippedTasks.some(task => context.task.name.includes(task))) {
    return;
  }

  // check profile call times equal end call times
  expect(console.profile.mock.calls.length).toBe(
    console.profileEnd.mock.calls.length,
  );
});
