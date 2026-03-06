/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

it('should not have debug-info.json emitted in production', () => {
  expect(fs.existsSync(
    path.resolve(__dirname, 'main/debug-info.json'),
  )).toBeFalsy();
});
