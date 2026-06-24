import { defineConfig } from 'vitest/config';
import codspeed from '@codspeed/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    include: [],
    benchmark: {
      include: ['bench/**/*.bench.vitest.spec.ts'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
  ],
});
