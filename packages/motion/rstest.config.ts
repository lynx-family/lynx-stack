import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  extends: withDefaultConfig({ rootPath: root }),
  root,
  name: 'motion',
  include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
  exclude: ['__tests__/utils/**'],
  coverage: {
    include: ['src/**'],
  },
});
