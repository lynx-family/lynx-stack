import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: require.resolve('@lynx-js/lynx-dom/env/vitest'),
    setupFiles: [
      path.join(__dirname, 'vitest.js'),
    ],
    exclude: [
      'types/__test__/**',
    ],
  },
});
