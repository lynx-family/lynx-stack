/// <reference types="@rstest/core/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should leave templateDebugUrl empty by default (only a plugin sets it)', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty('templateDebugUrl', '');
});
