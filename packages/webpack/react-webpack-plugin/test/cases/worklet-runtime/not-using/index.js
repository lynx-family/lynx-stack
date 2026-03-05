/// <reference types="vitest/globals" />
// @ts-check

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import './a.jsx';

it('should not have worklet-runtime', async () => {
  const source = await fs.readFile(
    path.resolve(
      path.join(
        path.dirname(__filename),
        '.rspeedy',
        'tasm.json',
      ),
    ),
    'utf-8',
  );
  const json = JSON.parse(source);
  expect(json['lepusCode']['lepusChunk']['worklet-runtime'])
    .toBe(undefined);
});

it('should not keep compiled worklet-runtime assets when injection is not needed', () => {
  const root = path.dirname(__filename);
  expect(existsSync(path.join(root, 'worklet-runtime.js'))).toBe(false);
  expect(existsSync(path.join(root, 'worklet-runtime.js.map'))).toBe(false);
});
