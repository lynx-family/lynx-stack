/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const importPromise = import(/* webpackChunkName: "comp" */ './comp.jsx');

it('should keep both layers of a named lazy bundle', async () => {
  const { Comp } = await importPromise;
  expect(typeof Comp).toBe('function');

  // Both layers land in the bundle's own directory, and the main-thread code
  // reaches `lepusCode` instead of being merged into the background chunk.
  const tasmJSON = await readFile(
    resolve(__dirname, '.rspeedy/lazy-bundle/comp/tasm.json'),
    'utf-8',
  );
  const { lepusCode, manifest } = JSON.parse(tasmJSON);
  expect(lepusCode.root).toBeTruthy();
  expect(Object.keys(manifest)).toContain(
    '/.rspeedy/lazy-bundle/comp/background.js',
  );
});
