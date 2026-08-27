import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from './dist/plugins/index.js';

export default defineConfig({
  define: {
    __MAIN_THREAD_OBJECT__: 'true',
  },
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
      engineVersion: '3.1',
    }),
  ],
  test: {
    name: 'react/testing-library/engine-3.1',
    include: [
      'src/__tests__/3.1/**/*.{js,jsx,ts,tsx}',
    ],
  },
});
