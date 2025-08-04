import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  define: {
    __DEV__: false,
  },
  test: {
    name: 'react/worklet-runtime',
    coverage: {
      exclude: [
        'dist/**',
        'lib/**',
        'rslib.config.ts',
        'src/api/lepusQuerySelector.ts',
        'src/api/lynxApi.ts',
        'src/bindings/**',
        'src/index.ts',
        'src/listeners.ts',
        'src/types/**',
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});

export default config;
