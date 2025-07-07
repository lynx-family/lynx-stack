import { defineConfig, type UserConfig } from 'vitest/config';

const config: UserConfig = defineConfig({
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
        'src/api/**',
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
