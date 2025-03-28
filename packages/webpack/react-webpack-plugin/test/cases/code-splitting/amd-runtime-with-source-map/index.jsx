/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const importPromise = import('./foo.js');

it('should have module.exports in foo.js template', async () => {
  const { foo } = await importPromise;
  await expect(foo()).resolves.toBe(`foo bar baz`);

  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/foo.js/tasm.json'),
      'utf-8',
    ),
  );

  const ret = eval(tasmJSON.lepusCode.root);

  expect(typeof ret).toBe('function');

  const exports = ret();

  expect(exports).toHaveProperty('ids', [
    './foo.js-react:main-thread',
  ]);

  expect(exports).toHaveProperty('modules', {
    '(react:main-thread)/./foo.js': expect.any(Function),
  });
});

it('should have module.exports in bar.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/bar.js/tasm.json'),
      'utf-8',
    ),
  );

  const ret = eval(tasmJSON.lepusCode.root);

  expect(typeof ret).toBe('function');

  const exports = ret();

  expect(exports).toHaveProperty('ids', [
    './bar.js-react:main-thread',
  ]);

  expect(exports).toHaveProperty('modules', {
    '(react:main-thread)/./bar.js': expect.any(Function),
  });
});

it('should have module.exports in baz.js template', async () => {
  const tasmJSON = JSON.parse(
    await readFile(
      resolve(__dirname, '.rspeedy/async/baz.js/tasm.json'),
      'utf-8',
    ),
  );

  const ret = eval(tasmJSON.lepusCode.root);

  expect(typeof ret).toBe('function');

  const exports = ret();

  expect(exports).toHaveProperty('ids', [
    './baz.js-react:main-thread',
  ]);

  expect(exports).toHaveProperty('modules', {
    '(react:main-thread)/./baz.js': expect.any(Function),
  });
});
