import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);

// `@lynx-js/devtool-connector`'s `package.json#exports` points at raw
// TypeScript (`./src/index.ts`) whose modules import siblings with explicit
// `.ts` extensions, which rstest cannot load in the externalized node env.
// Worse, this package's `tsconfig.json#paths` redirects the bare specifier to
// `dist/index.d.ts` — a declaration file that re-exports from
// `./streams/peertalk.ts`, a `.ts` path that does NOT exist in `dist/` (only
// `peertalk.js` does). rsbuild honors those `paths`, so resolution lands on the
// `.d.ts` and fails with "Can't resolve './streams/peertalk.ts'".
//
// Fix: alias both entries to the real built JS in `dist/`, which Node loads
// natively, and use `prefer-alias` so this wins over the broken tsconfig path.
const connectorDir = path.dirname(
  require.resolve('@lynx-js/devtool-connector/package.json'),
);

export default defineConfig({
  testEnvironment: 'node',
  testTimeout: 60000,
  hookTimeout: 60000,
  resolve: {
    // `tsconfig.json#paths` points the bare specifier at a `.d.ts`; without
    // this, rsbuild's default `prefer-tsconfig` strategy would let that broken
    // path win over the alias below.
    aliasStrategy: 'prefer-alias',
    alias: {
      '@lynx-js/devtool-connector/transport': path.join(
        connectorDir,
        'dist/transport/index.js',
      ),
      '@lynx-js/devtool-connector': path.join(connectorDir, 'dist/index.js'),
    },
  },
});
