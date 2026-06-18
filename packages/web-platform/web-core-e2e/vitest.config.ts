import codspeed from '@codspeed/vitest-plugin';
import * as path from 'path';
import { defineConfig } from 'vitest/config';

// vitest config used ONLY for the codspeed benchmark (`pnpm run bench`); the
// package's tests run on rstest (see rstest.config.ts). rstest has no bench API,
// so the perf benchmark stays on vitest.
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
    benchmark: {
      include: ['bench/**/*.bench.vitest.spec.ts'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
  ],
});
