/// <reference types="@rstest/core/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should have custom templateDebugUrl in tasm.json from hook', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty(
    'templateDebugUrl',
    'https://custom-hook-url.com/debug-info.json',
  );
});
