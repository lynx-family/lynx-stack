import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from './dist/vitest.config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
});
const config = defineConfig({
  test: {
    name: 'react/testing-library',
    include: ['src/**/*.test.{js,jsx,ts,tsx}', '!src/__tests__/3.1/**/*.{js,jsx,ts,tsx}'],
  },
});

export default mergeConfig(defaultConfig, config);
