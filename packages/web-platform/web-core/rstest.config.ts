import { defineConfig } from '@rstest/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'web-platform/web-core',
  include: ['./tests/*.spec.ts'],
  // The jsdom environment is instantiated manually in `tests/jsdom.ts`
  // (imported by each spec via `import './jsdom.js'`). That setup file
  // surfaces jsdom globals, mocks `fetch` for wasm loading and provides a
  // MessageChannel-based Worker mock. We therefore run on the `node`
  // environment and let the setup file provide the DOM globals, matching the
  // previous vitest behaviour (which used the same manual JSDOM instance).
  testEnvironment: 'node',
  globals: true,
  resolve: {
    alias: {
      // Replicates the vitest `transform-debug-wasm` Vite plugin's glue swap:
      // load the debug wasm-bindgen glue (`client_debug.js`) instead of the
      // optimized `client.js` so the glue's import names match the debug wasm
      // binary that `tests/loaders/debug-wasm-loader.cjs` redirects the runtime
      // `fetch` to. (The `import()` specifier cannot be rewritten via a loader
      // because rspack resolves that dependency from the original source.)
      [path.resolve(__dirname, './binary/client/client.js')]: path.resolve(
        __dirname,
        './binary/client/client_debug.js',
      ),
    },
  },
  tools: {
    rspack: {
      module: {
        // Leave `new URL('...client_bg.wasm', import.meta.url)` untouched so it
        // resolves at runtime to the real on-disk file URL. Otherwise rspack
        // rewrites it to an emitted asset path that does not exist on disk
        // during in-memory test bundling, breaking the `fetch` wasm mock in
        // `tests/jsdom.ts`.
        parser: {
          javascript: { url: false },
        },
        // Replicates the vitest `transform-debug-wasm` Vite plugin: swap the
        // optimized wasm/js binding for the debug build inside `ts/client/wasm.ts`.
        rules: [
          {
            test: /ts[\\/]client[\\/]wasm\.ts$/,
            use: [
              {
                loader: path.resolve(
                  __dirname,
                  './tests/loaders/debug-wasm-loader.cjs',
                ),
              },
            ],
          },
        ],
      },
    },
  },
});

export default config;
