/// <reference types="@rspack/test-tools/rstest" />

import { existsSync } from 'node:fs';
import path from 'node:path';

it('should have changed template', () => {
  expect(
    existsSync(path.resolve(__dirname, 'main.template.js')),
  ).toBeFalsy();
});
