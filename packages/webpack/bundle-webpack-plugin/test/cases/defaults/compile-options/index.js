/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should match default compilerOptions', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toMatchSnapshot();
});
