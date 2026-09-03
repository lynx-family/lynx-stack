import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  extends: withDefaultConfig({ rootPath: root }),
  root,
  name: 'lynx/gesture-runtime',
  setupFiles: ['__test__/utils/setup.ts'],
  include: ['__test__/**/*.test.{js,jsx,ts,tsx}'],
  exclude: ['__test__/utils/**'],
  coverage: {
    include: ['src/**'],
  },
});
