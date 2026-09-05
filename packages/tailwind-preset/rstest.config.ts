import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'tailwind-preset',
  testEnvironment: 'node',
  include: ['src/**/*.{test,spec}.{js,ts}'],
  globals: true,
});
