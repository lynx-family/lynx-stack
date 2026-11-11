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
    // Compiled ESM must retain native relative chunk resolution. Reprocessing
    // it in Vite's web-mode pipeline drops the Windows drive from /dist URLs.
    server: {
      deps: {
        external: [/[/\\]motion[/\\]dist[/\\]/],
      },
    },
    include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
    exclude: ['__tests__/utils/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
