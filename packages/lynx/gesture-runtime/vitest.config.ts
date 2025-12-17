import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig();
const config = defineConfig({
  test: {
    name: 'lynx/gesture-runtime',
    setupFiles: ['__test__/utils/setup.ts'],
    coverage: {
      include: ['src/**'],
    },
    include: ['__test__/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['__test__/utils/**'],
  },
});

export default mergeConfig(defaultConfig, config);
