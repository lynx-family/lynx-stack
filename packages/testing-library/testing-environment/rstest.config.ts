import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'testing-library/lynx-environment',
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('./src/setupFiles/rstest.js'),
  ],
  globals: true,
  include: ['src/**/*.test.{js,jsx,ts,tsx}'],
});
