/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { snapshotManager } from '@lynx-js/react/internal';

const importPromise = import('./foo.js');

it('should have globDynamicComponentEntry', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/main/tasm.json'),
      'utf-8',
    ),
  );

  const mainThreadCode = tasmJSON.lepusCode['root'];
  const backgroundCode = await readFile(
    __filename,
    'utf-8',
  );
  // main-thread.js has one more globDynamicComponentEntry than background.js
  // at the parameter of the IIFE.
  expect(mainThreadCode.split('globDynamicComponentEntry').length)
    .toBeGreaterThan(backgroundCode.split('globDynamicComponentEntry').length);

  const jsx = <view id='xxx' />;
  expect(jsx).toBeDefined();

  expect(snapshotManager.values.get(jsx.type).entryName).toBe(
    globDynamicComponentEntry,
  );
});

it('should have module.exports in foo.js template', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`foo bar baz`);

  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/foo.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function (globDynamicComponentEntry)'),
  );

  expect(tasmJSON.manifest['/.rspeedy/async/./foo.js-react:background.js'])
    .toBeDefined();
  expect(tasmJSON.manifest['/.rspeedy/async/./foo.js-react:background.js']).not
    .toContain('const module = { exports: {} }');
  expect(tasmJSON.manifest['/.rspeedy/async/./foo.js-react:background.js']).not
    .toContain('function (globDynamicComponentEntry)');
});

it('should have module.exports in bar.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/bar.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function (globDynamicComponentEntry)'),
  );

  expect(tasmJSON.manifest['/.rspeedy/async/./bar.js-react:background.js'])
    .toBeDefined();
  expect(tasmJSON.manifest['/.rspeedy/async/./bar.js-react:background.js']).not
    .toContain('const module = { exports: {} }');
  expect(tasmJSON.manifest['/.rspeedy/async/./bar.js-react:background.js']).not
    .toContain('function (globDynamicComponentEntry)');
});

it('should have module.exports in baz.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/baz.js/tasm.json'),
      'utf-8',
    ),
  );

  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('const module = { exports: {} }'),
  );
  expect(tasmJSON.lepusCode).toHaveProperty(
    'root',
    expect.stringContaining('function (globDynamicComponentEntry)'),
  );

  expect(tasmJSON.manifest['/.rspeedy/async/./baz.js-react:background.js'])
    .toBeDefined();
  expect(tasmJSON.manifest['/.rspeedy/async/./baz.js-react:background.js']).not
    .toContain('const module = { exports: {} }');
  expect(tasmJSON.manifest['/.rspeedy/async/./baz.js-react:background.js']).not
    .toContain('function (globDynamicComponentEntry)');
});
