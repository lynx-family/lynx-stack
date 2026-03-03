import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    include: ['src/**/*.test.ts'],
    alias: {
      '@lynx-js/vue-runtime/entry-background': path.resolve(
        __dirname,
        '../runtime/src/entry-background.ts',
      ),
      '@lynx-js/vue-runtime': path.resolve(
        __dirname,
        '../runtime/src/index.ts',
      ),
      '@lynx-js/vue-main-thread': path.resolve(
        __dirname,
        '../main-thread/src/entry-main.ts',
      ),
    },
  },
});
