import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
    }),
  ],
  test: {
    name: 'testing-library/examples/basic',
  },
});
