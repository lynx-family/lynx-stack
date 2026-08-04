/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadShared as loadFromFirst } from './first.js';
import { loadShared as loadFromSecond } from './second.js';

it('should load a shared async chunk from multiple import sites', async () => {
  const [first, second] = await Promise.all([
    loadFromFirst(),
    loadFromSecond(),
  ]);

  expect(first.value).toBe('shared');
  expect(second.value).toBe('shared');
});

it('should wrap the shared main-thread asset once', async () => {
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
