import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        include: ['test/**/*.test.{js,ts,jsx,tsx}'],
      };
    },
  }),
});

export default config;
