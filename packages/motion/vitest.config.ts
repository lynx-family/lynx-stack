import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    {
      name: 'test-compiled-motion',
      enforce: 'pre',
      resolveId(id) {
        const entry = /\/upstream\/(full|mini)\.js$/.exec(id)?.[1];
        if (entry) {
          return fileURLToPath(
            new URL(`./dist/upstream/${entry}.js`, import.meta.url),
          ).replaceAll('\\', '/');
        }
      },
    },
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
