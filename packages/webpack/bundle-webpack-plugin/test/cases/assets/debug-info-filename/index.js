/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should have debug-info.json emitted', async () => {
  const content = await fs.readFile(
    path.resolve(__dirname, 'debug-info.json'),
  );

  expect(content.length).not.toBe(0);
});

it('should have templateDebugUrl in tasm.json', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, 'tasm.json'),
    'utf-8',
  );

  const { compilerOptions } = JSON.parse(tasmJSON);

  expect(compilerOptions).toHaveProperty(
    'templateDebugUrl',
    'https://example.com/debug-info.json',
  );
});
