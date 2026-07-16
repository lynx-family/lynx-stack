/// <reference types="vitest/globals" />

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const importPromise = import('./foo.js');

it('should have async debug-info.json', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`foo bar baz`);

  const asyncAssets = await readdir(resolve(__dirname, '.rspeedy/lazy-bundle'));
  expect(asyncAssets).toContain('foo.js');
  expect(asyncAssets).toContain('bar.js');
  expect(asyncAssets).toContain('baz.js');
});

it('should have correct main-thread content', async () => {
  const root = resolve(__dirname, '.rspeedy/lazy-bundle');
  const foo = resolve(root, 'foo.js/tasm.json');
  const bar = resolve(root, 'bar.js/tasm.json');
  const baz = resolve(root, 'baz.js/tasm.json');

  const fooContent = JSON.parse(await readFile(foo, 'utf-8'));
  expect(fooContent.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function foo()'),
  );

  const barContent = JSON.parse(await readFile(bar, 'utf-8'));
  expect(barContent.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function bar()'),
  );

  const bazContent = JSON.parse(await readFile(baz, 'utf-8'));
  expect(bazContent.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function baz()'),
  );
});
