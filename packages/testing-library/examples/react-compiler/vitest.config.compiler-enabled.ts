import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
  experimental_enableReactCompiler: true,
});
const config = defineConfig({
  define: {
    __FORGET__: 'true',
  },
  test: {
    name: 'testing-library/examples/react-compiler-enabled',
  },
});
export default mergeConfig(defaultConfig, config);
