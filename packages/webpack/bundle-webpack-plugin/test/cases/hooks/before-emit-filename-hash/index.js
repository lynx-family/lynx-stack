/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import path from 'node:path';

it('should have changed template', () => {
  expect(
    existsSync(path.resolve(__dirname, 'main.template.js')),
  ).toBeFalsy();
});
