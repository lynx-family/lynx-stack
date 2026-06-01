/// <reference types="@rstest/core/globals" />

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

it('should not emit debug-info.json', () => {
  expect(
    existsSync(path.resolve(__dirname, '.rspeedy/main/debug-info.json')),
  ).toBe(false);
});

it('should leave templateDebugUrl empty when publicPath is auto', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty('templateDebugUrl', '');
});
