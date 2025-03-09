import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: require.resolve('@lynx-js/lynx-dom/env/vitest'),
    exclude: [
      'types/__tests__/**',
    ],
  },
});
