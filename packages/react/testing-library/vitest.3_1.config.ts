import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from './dist/vitest.config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
  engineVersion: '3.1',
  include: [
    'src/__tests__/3.1/**/*.{js,jsx,ts,tsx}',
  ],
});
const config = defineConfig({
  test: {
    name: 'react/testing-library/engine-3.1',
  },
});

export default mergeConfig(defaultConfig, config);
