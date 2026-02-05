import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lynx-js/web-core-wasm/server': path.resolve(
        __dirname,
        '../web-core-wasm/ts/server/index.ts',
      ),
      '@lynx-js/web-core-wasm': path.resolve(
        __dirname,
        '../web-core-wasm/ts/client/index.ts',
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
