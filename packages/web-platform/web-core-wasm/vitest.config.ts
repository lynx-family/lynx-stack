import { defineConfig } from 'vitest/config';
import codspeed from '@codspeed/vitest-plugin';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    name: 'web-platform/web-core-tests',
    include: ['./tests/*.spec.ts'],
    exclude: ['./tests/*.bench.spec.ts'],
    benchmark: {
      include: ['./tests/*.bench.spec.ts'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
    wasm(),
  ],
  resolve: {
    alias: {
      '../../binary/client/client.js': path.join(
        __dirname,
        'binary',
        'client',
        'client_debug.js',
      ),
    },
  },
});
