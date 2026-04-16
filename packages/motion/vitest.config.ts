import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
  test: {
    include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
    exclude: ['__tests__/utils/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
