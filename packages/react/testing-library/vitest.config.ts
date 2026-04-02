import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from './dist/plugins/index.js';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin({
      runtimePkgName: '@lynx-js/react',
    }),
  ],
  test: {
    name: 'react/testing-library',
    include: ['src/**/*.test.{js,jsx,ts,tsx}', '!src/__tests__/3.1/**/*.{js,jsx,ts,tsx}'],
  },
});
