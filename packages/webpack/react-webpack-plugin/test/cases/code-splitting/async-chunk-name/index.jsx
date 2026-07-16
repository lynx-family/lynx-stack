/// <reference types="vitest/globals" />

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const importPromise = import('./foo.js');

it('should have async templates', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`foo bar baz`);

  const asyncTemplates = await readdir(resolve(__dirname, 'lazy-bundle'));
  expect(asyncTemplates).toHaveLength(3); // foo, bar, baz
});
