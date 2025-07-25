import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from './dist/plugins';

export default defineConfig({
  test: {
    name: 'react/testing-library',
  },
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
    }),
  ],
});
