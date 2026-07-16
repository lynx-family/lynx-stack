/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

it('should have chunkName', async () => {
  if (__JS__) {
    const importPromise = import('./foo.js');
    const { foo } = await importPromise;
    await expect(foo()).resolves.toBe(`**foo****bar****baz****baz**`);

    const content = await readFile(__filename, 'utf-8');

    expect(content).toContain(
      `__webpack_require__.e(/*! import() */ "_react_background_foo_js")`,
    );
  }
});

it('should not have duplicated chunk', async () => {
  const files = await readdir(join(__dirname, '.rspeedy/lazy-bundle'), {
    recursive: true,
  });
  expect(
    files.filter(file => file.endsWith('background.js')).length,
  ).toBe(
    [
      'foo',
      'bar',
      'baz',
    ].length,
  );
});

it('should have async chunks', () => {
  if (__JS__) {
    expect(['foo', 'bar', 'baz'].every(entry =>
      existsSync(join(
        __dirname,
        `.rspeedy/lazy-bundle/${entry}.js/background.js`,
      ))
    )).toBeTruthy();
  }
});
