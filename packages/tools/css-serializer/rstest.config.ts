import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'tools/css-serializer',
  include: ['test/*.spec.ts', 'test/*.test.ts'],
});
