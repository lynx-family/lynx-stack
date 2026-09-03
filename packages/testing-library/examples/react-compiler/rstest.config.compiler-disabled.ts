import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  extends: withDefaultConfig({
    rootPath: root,
    experimental_enableReactCompiler: false,
  }),
  root,
  name: 'testing-library/examples/react-compiler-disabled',
  include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  source: {
    define: {
      __FORGET__: 'false',
    },
  },
});
