import { defineConfig } from 'vitest/config';
// import codspeed from '@codspeed/vitest-plugin';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    include: ['**/tests/*.spec.ts'],
    name: 'web-platform/web-core-tests',
    // benchmark: {
    //   include: ['**/tests/*.bench.vitest.spec.ts'],
    // },
  },
  plugins: [
    // process.env['CI'] ? codspeed() : undefined,
    wasm(),
  ],
  resolve: {
    alias: {
      '../dist/standard.js': path.join(__dirname, 'dist', 'debug.js'),
    },
  },
});
