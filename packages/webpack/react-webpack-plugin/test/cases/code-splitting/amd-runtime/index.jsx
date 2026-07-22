/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const importPromise = import('./foo.js');

it('should have module.exports in foo.js template', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`foo bar baz`);

  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/lazy-bundle/foo.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
});

it('should have module.exports in bar.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/lazy-bundle/bar.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
});

it('should have module.exports in baz.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/lazy-bundle/baz.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
});
