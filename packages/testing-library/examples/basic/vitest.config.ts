import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
});
const config = defineConfig({
  test: {
    name: 'testing-library/examples/basic',
  },
});

export default mergeConfig(defaultConfig, config);
