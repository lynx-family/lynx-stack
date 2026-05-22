/// <reference types="@rstest/core/globals" />

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

it('should not emit debug-info.json', () => {
  expect(
    existsSync(path.resolve(__dirname, 'debug-info.json')),
  ).toBe(false);
});

it('should have templateDebugUrl pointing at debug-metadata endpoint', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, 'tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty(
    'templateDebugUrl',
    'https://example.com/debug-metadata.json?field=bytecode-debug-info&filename=main-thread.js',
  );
});
