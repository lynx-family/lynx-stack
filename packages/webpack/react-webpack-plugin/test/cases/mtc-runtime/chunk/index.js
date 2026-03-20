/// <reference types="vitest/globals" />
// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

import './a.jsx';

it('should have mtc-runtime', async () => {
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
  expect(json['lepusCode']['lepusChunk']['mtc-runtime'].length > 0)
    .toBe(true);
});
