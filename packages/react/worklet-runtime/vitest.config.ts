import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  define: {
    __DEV__: false,
  },
  test: {
    name: 'react/worklet-runtime',
    coverage: {
      allowExternal: true,
      include: ['../runtime/src/worklet-runtime/**/*.ts'],
      exclude: [
        'dist/**',
        'lib/**',
        'src/**',
        'rslib.config.ts',
        '../runtime/src/worklet-runtime/api/lepusQuerySelector.ts',
        '../runtime/src/worklet-runtime/api/lynxApi.ts',
        '../runtime/src/worklet-runtime/bindings/**',
        '../runtime/src/worklet-runtime/global.ts',
        '../runtime/src/worklet-runtime/index.ts',
        '../runtime/src/worklet-runtime/listeners.ts',
        '../runtime/src/worklet-runtime/types/**',
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
