// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test, vi } from 'vitest';

test('preact/debug - preserves original render error when queueMicrotask is unavailable', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  const originalQueueMicrotask = globalThis.queueMicrotask;
  delete globalThis.queueMicrotask;

  try {
    await import('preact/debug');
    const { root } = await import('../../../src/index');

    function Boom() {
      throw new Error('original render boom');
    }

    expect(() => root.render(<Boom />)).toThrow('original render boom');
  } finally {
    globalThis.queueMicrotask = originalQueueMicrotask;
  }
});
