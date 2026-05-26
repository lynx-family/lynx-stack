/// <reference types="@rstest/core/globals" />

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

it('should not emit debug-info.json', () => {
  expect(
    existsSync(path.resolve(__dirname, '.rspeedy/main/debug-info.json')),
  ).toBe(false);
});

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

it('should leave debugMetadataUrl empty when the hook only sets templateDebugUrl', async () => {
  const tasmJSON = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  const { sourceContent } = JSON.parse(tasmJSON);

  expect(sourceContent.config).toHaveProperty('debugMetadataUrl', '');
});
