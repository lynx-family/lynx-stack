import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
      experimental_enableReactCompiler: false,
    }),
  ],
  define: {
    __FORGET__: 'false',
  },
  test: {
    name: 'testing-library/examples/react-compiler-disabled',
  },
});
