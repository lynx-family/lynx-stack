import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
      experimental_enableReactCompiler: true,
    }),
  ],
  define: {
    __FORGET__: 'true',
  },
  test: {
    name: 'testing-library/examples/react-compiler-enabled',
  },
});
