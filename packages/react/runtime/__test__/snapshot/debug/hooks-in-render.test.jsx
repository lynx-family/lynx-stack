import { expect, test, rstest as vi } from '@rstest/core';

test('preact/debug - Hook can only be invoked from render methods', async () => {
  vi.stubGlobal('__MAIN_THREAD__', false)
    .stubGlobal('__LEPUS__', false);

  await import('preact/debug');
  const { useState } = await import('../../../src/index');

  expect(() => useState(0)).toThrowErrorMatchingInlineSnapshot(
    `[Error: Hook can only be invoked from render methods.]`,
  );
});
