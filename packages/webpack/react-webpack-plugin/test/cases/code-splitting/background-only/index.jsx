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
      `__webpack_require__.e(/*! import() | ./foo.js-react__background */ "./foo.js-react__background")`,
    );
  }
});

it('should not have duplicated chunk', async () => {
  const files = await readdir(__dirname, { recursive: false });
  expect(
    files.filter(file => file.endsWith('.js')),
  ).toHaveLength(
    [
      'main',
      'main__background',
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
        `${entry}.js-react__background.js`,
      ))
    )).toBeTruthy();
  }
});
