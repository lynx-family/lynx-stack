/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

it('should load a shared async chunk from multiple async parents', async () => {
  const [{ loadShared: loadFromFirst }, { loadShared: loadFromSecond }] =
    await Promise.all([
      import('./first.js'),
      import('./second.js'),
    ]);
  const [first, second] = await Promise.all([
    loadFromFirst(),
    loadFromSecond(),
  ]);

  expect(first.value).toBe('shared');
  expect(second.value).toBe('shared');
});

it('should wrap the nested shared main-thread asset once', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/lazy-bundle/shared.js/tasm.json'),
      'utf-8',
    ),
  );

  const wrappers = tasmJSON.lepusCode.root.match(
    /\(function \(globDynamicComponentEntry\) \{/g,
  );
  expect(wrappers).toHaveLength(1);
});
