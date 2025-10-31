import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
  experimental_enableReactCompiler: false,
});
const config = defineConfig({
  define: {
    __FORGET__: 'false',
  },
  test: {
    name: 'testing-library/examples/react-compiler-disabled',
  },
});
export default mergeConfig(defaultConfig, config);
