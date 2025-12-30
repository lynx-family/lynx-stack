import { defineConfig } from 'vitest/config';
import codspeed from '@codspeed/vitest-plugin';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    name: 'web-platform/web-core-wasm',
    include: ['./tests/*.spec.ts'],
    exclude: ['./tests/*.bench.spec.ts'],
    benchmark: {
      include: ['./tests/*.bench.spec.ts'],
    },
    coverage: {
      include: ['ts/**', 'src/**'],
    },
  },
  plugins: [
    {
      name: 'transform-debug-wasm',
      transform(code, id) {
        if (id.endsWith('ts/client/wasm.ts')) {
          return code
            .replace(
              'client/client.js',
              'client/client_debug.js',
            )
            .replace(
              'client/client_bg.wasm',
              'client/client_debug_bg.wasm',
            );
        }
        return undefined;
      },
    },
    process.env['CI'] ? codspeed() : undefined,
  ],
});
