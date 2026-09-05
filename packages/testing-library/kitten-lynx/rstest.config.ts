import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'testing-library/kitten-lynx',
  testEnvironment: 'node',
  include: ['tests/**/*.{test,spec}.{js,ts}'],
  testTimeout: 60_000,
  hookTimeout: 60_000,
});
