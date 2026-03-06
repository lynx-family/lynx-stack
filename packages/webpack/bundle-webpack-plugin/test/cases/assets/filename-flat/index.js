/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

it('should have debug-info.json emitted', async () => {
  const content = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/debug-info.json'),
  );

  expect(content.length).not.toBe(0);
});

it('should have tasm.json emitted', () => {
  expect(existsSync(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
  )).toBeTruthy();
});

it('should have main.template.js emitted', () => {
  expect(existsSync(
    path.resolve(__dirname, 'main.template.js'),
  )).toBeTruthy();
});
