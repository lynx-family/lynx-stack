/// <reference types="vitest/globals" />

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { load } from './subdir/importer.js';

it('should resolve the same file imported via different paths', async () => {
  const { foo } = await import('./foo.js');
  const { foo: fooFromSubdir } = await load();
  const { foo: fooFromAlias } = await import('@/foo.js');

  expect(foo()).toBe(42);
  expect(fooFromSubdir()).toBe(42);
  expect(fooFromAlias()).toBe(42);
});

it('should generate a single lazy bundle inside the async directory', async () => {
  const bundles = (await readdir(join(__dirname, 'lazy-bundle'), {
    recursive: true,
  })).filter(name => name.endsWith('.bundle'));

  expect(bundles).toHaveLength(1);
  expect(bundles[0]).toMatch(/^foo\.js\.[0-9a-f]+\.bundle$/);

  const escapedBundles = (await readdir(__dirname)).filter(name =>
    name.endsWith('.bundle')
  );
  expect(escapedBundles).toHaveLength(0);
});

it('should wrap the shared main-thread asset once', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      join(__dirname, '.rspeedy/lazy-bundle/foo.js/tasm.json'),
      'utf-8',
    ),
  );

  const wrappers = tasmJSON.lepusCode.root.match(
    /\(function \(globDynamicComponentEntry\) \{/g,
  );
  expect(wrappers).toHaveLength(1);
});
