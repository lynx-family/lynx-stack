import { defineConfig } from 'vitest/config';
import codspeed from '@codspeed/vitest-plugin';
import * as path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lynx-js/web-core/server': path.resolve(
        __dirname,
        '../web-core/ts/server/index.ts',
      ),
      '@lynx-js/web-core': path.resolve(
        __dirname,
        '../web-core/ts/client/index.ts',
      ),
    },
  },
  test: {
    include: ['server-tests/**/*.test.ts'],
    exclude: ['bench/**/*.bench.vitest.spec.ts'],
    testTimeout: 10000,
    benchmark: {
      include: ['bench/**/*.bench.vitest.spec.ts'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
  ],
});
