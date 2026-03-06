/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

it('should have updated css from beforeEncode hook in tasm.json', async () => {
  const target = path.resolve(
    __dirname,
    '.rspeedy',
    'tasm.json',
  );
  expect(existsSync(target)).toBe(true);

  const content = await fs.readFile(target, 'utf-8');

  const { css } = JSON.parse(content);

  expect(css.cssMap).toHaveProperty('1');
  expect(css.cssSource).toStrictEqual({
    1: '/cssId/1.css',
  });
});
