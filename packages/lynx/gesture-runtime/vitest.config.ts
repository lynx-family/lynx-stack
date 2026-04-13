import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
  test: {
    name: 'lynx/gesture-runtime',
    setupFiles: ['__test__/utils/setup.ts'],
    coverage: {
      include: ['src/**'],
    },
    include: ['__test__/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['__test__/utils/**'],
  },
});
