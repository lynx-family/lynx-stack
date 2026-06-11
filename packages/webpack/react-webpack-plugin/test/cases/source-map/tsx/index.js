/// <reference types="vitest/globals" />
// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

import { checkSourceMap } from '@lynx-js/test-tools/helper/checkSourceMap.js';

import './a.tsx';

it('should have source-map', async () => {
  const source = await fs.readFile(
    path.resolve(__filename + '.map'),
    'utf-8',
  );
  const map = JSON.parse(source);

  expect(source).not.toBe('');
  expect(map).toHaveProperty(['sources']);
  expect(map).toHaveProperty(['mappings']);
});

it('should verify sourcemap of jsx', async () => {
  const source = await fs.readFile(
    path.resolve(__filename + '.map'),
    'utf-8',
  );
  const map = JSON.parse(source);

  expect(map.sources).toMatchObject(
    expect.arrayContaining([
      'webpack:///./a.tsx',
      'webpack:///./index.js',
    ]),
  );

  const out = await fs.readFile(__filename, { encoding: 'utf-8' });
  await checkSourceMap(out, source, {
    '\'*a0*\'': 'webpack:///a.tsx',
    '\'*a1*\'': 'webpack:///a.tsx',
    '\'*a2*\'': 'webpack:///a.tsx',
  });
  expect(true).toBe(true);
});
