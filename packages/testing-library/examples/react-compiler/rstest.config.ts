import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  projects: [
    path.join(root, 'rstest.config.compiler-enabled.ts'),
    path.join(root, 'rstest.config.compiler-disabled.ts'),
  ],
});
