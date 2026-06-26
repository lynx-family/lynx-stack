import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

// Self-contained rstest config for the remap snapshot tests. Scoped to this
// folder so it doesn't pull in the example's build tooling.
export default defineConfig({
  name: 'error-remapping',
  root: dirname(fileURLToPath(import.meta.url)),
  include: ['**/*.test.ts'],
});
