/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadShared as loadFromFirst } from './first.js';
import { loadShared as loadFromSecond } from './second.js';

it('should load a shared module merged into the entry chunk', async () => {
  const [first, second] = await Promise.all([
    loadFromFirst(),
    loadFromSecond(),
  ]);

  expect(first.value).toBe('shared');
  expect(second.value).toBe('shared');
});

it('should not wrap the entry main-thread chunk in the dynamic component IIFE', async () => {
  // `splitChunks` merged the shared module into the entry chunk, so the entry
  // chunk is referenced by the lazy bundle chunk groups. The entry's own
  // main-thread root must still run, so it must not be wrapped in the dynamic
  // component IIFE. See #4044.
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/main/tasm.json'),
      'utf-8',
    ),
  );

  const wrappers = (tasmJSON.lepusCode.root ?? '').match(
    /\(function \(globDynamicComponentEntry\) \{/g,
  );
  expect(wrappers).toBeNull();
});
