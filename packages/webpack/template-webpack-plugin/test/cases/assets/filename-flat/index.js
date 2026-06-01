/// <reference types="@rstest/core/globals" />

import { existsSync } from 'node:fs';
import path from 'node:path';

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
