/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should match default pageConfig', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { sourceContent } = JSON.parse(tasmJSON);

  expect(sourceContent['config']).toMatchSnapshot();
});
