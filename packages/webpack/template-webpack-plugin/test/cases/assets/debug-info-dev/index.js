/// <reference types="@rstest/core/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

const DEV_METADATA_URL =
  'http://10.0.0.2:3000/.rspeedy/main/debug-metadata.json';

it('should carry the dev-server debug-metadata URL set by a plugin', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { compilerOptions, sourceContent } = JSON.parse(tasmJSON);

  expect(sourceContent.config).toHaveProperty(
    'debugMetadataUrl',
    DEV_METADATA_URL,
  );
  expect(compilerOptions).toHaveProperty(
    'templateDebugUrl',
    `${DEV_METADATA_URL}?field=bytecode-debug-info&filename=main-thread.js`,
  );
});
