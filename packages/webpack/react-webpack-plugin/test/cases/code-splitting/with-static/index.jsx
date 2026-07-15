/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const importPromise = import('./foo.js');

it('should have chunkName', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`**foo****bar****baz****baz**`);

  const content = await readFile(__filename, 'utf-8');

  const LAYER = __LEPUS__ ? 'main-thread' : 'background';

  expect(content).toContain(
    `__webpack_require__.e(/* import() */ "_react_${LAYER}_foo_js")`,
  );
});

it('should not have duplicated chunk', async () => {
  const files = await readdir(__dirname, { recursive: false });
  expect(
    files.filter(file => file.endsWith('.js')),
  ).toHaveLength(
    [
      'main',
      'foo',
      'bar',
      // 'baz' // baz is static imported
    ].length * 2,
  );
});

it('should have async chunks', () => {
  const LAYER = __LEPUS__ ? 'main-thread' : 'background';

  expect([
    'foo',
    'bar',
    // 'baz' // baz is static imported
  ].every(entry =>
    existsSync(join(
      __dirname,
      `_react_${LAYER}_${entry}_js.js`,
    ))
  )).toBeTruthy();
});
