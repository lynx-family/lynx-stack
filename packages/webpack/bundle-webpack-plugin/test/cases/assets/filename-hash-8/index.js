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

it('should have main.template.[hash].js emitted', async () => {
  expect(existsSync(
    path.resolve(__dirname, 'main/template.js'),
  )).toBeFalsy();

  const files = await fs.readdir(path.resolve(__dirname, 'main'));
  expect(
    files.find(filename => filename.match(/template\.[0-9a-fA-F]{8}\.js$/)),
  ).not.toBeUndefined();
});
