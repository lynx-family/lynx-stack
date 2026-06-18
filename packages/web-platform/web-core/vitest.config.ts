import codspeed from '@codspeed/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// vitest config used ONLY for the codspeed benchmark (`pnpm run bench`); the
// package's tests run on rstest (see rstest.config.ts). rstest has no bench API,
// so the perf benchmark stays on vitest.
export default defineConfig({
  test: {
    globals: true,
    benchmark: {
      include: ['./tests/*.bench.spec.ts'],
    },
  },
  plugins: [
    {
      name: 'transform-in-shadow-css',
      enforce: 'pre',
      load(id) {
        if (id.includes('in_shadow.css')) {
          if (id.includes('bulk')) {
            return `export default "/* INJECTED_SHADOW_CSS_BULK */";`;
          }
          return `export default "/* INJECTED_SHADOW_CSS */";`;
        }
        return undefined;
      },
    },
    {
      name: 'transform-debug-wasm',
      transform(code, id) {
        if (id.endsWith('ts/client/wasm.ts')) {
          return code
            .replace('client/client.js', 'client/client_debug.js')
            .replace('client/client_bg.wasm', 'client/client_debug_bg.wasm');
        }
        return undefined;
      },
    },
    process.env['CI'] ? codspeed() : undefined,
  ],
});
