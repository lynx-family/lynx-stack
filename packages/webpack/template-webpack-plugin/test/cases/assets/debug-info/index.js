/// <reference types="@rstest/core/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should have templateDebugUrl pointing at debug-metadata endpoint', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty(
    'templateDebugUrl',
    'https://example.com/.rspeedy/main/debug-metadata.json?field=bytecode-debug-info&filename=main-thread.js',
  );
});
