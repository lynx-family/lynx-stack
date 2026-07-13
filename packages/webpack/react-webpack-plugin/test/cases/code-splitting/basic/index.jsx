/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const importPromise = import('./foo.js');

it('should have chunkName', async () => {
  const { foo } = await importPromise;
  expect(foo()).toBe(42);

  const content = await readFile(__filename, 'utf-8');

  const LAYER = __LEPUS__ ? 'main-thread' : 'background';

  expect(content).toContain(
    `__webpack_require__.e(/* import() */ "_react_${LAYER}_foo_js")`,
  );
});

it('should have async chunks', () => {
  const LAYER = __LEPUS__ ? 'main-thread' : 'background';

  expect(existsSync(
    join(__dirname, `_react_${LAYER}_foo_js.js`),
  )).toBeTruthy();
});
