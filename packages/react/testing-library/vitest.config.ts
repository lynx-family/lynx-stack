import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from './dist/vitest.config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
});
const config = defineConfig({
  test: {
    name: 'react/testing-library',
  },
});

export default mergeConfig(defaultConfig, config);
