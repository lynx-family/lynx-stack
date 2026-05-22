import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      bundle: true,
      autoExternal: false,
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
    entry: {
      index: './src/index.ts',
      'mini/index': './src/mini/index.ts',
    },
    define: {
      // Replace bare `window` with `globalThis` so motion-dom/framer-motion code
      // works inside web-core's MTS IIFE wrapper (which shadows window = void 0).
      // On native Lynx, the shim populates globalThis with the needed APIs.
      'window': 'globalThis',
      // Preserve Lynx build-time constants for the consumer's bundler to define.
      '__MAIN_THREAD__': '__MAIN_THREAD__',
      '__DEV__': '__DEV__',
      '__BACKGROUND__': '__BACKGROUND__',
    },
  },
  output: {
    externals: [
      '@lynx-js/react',
      '@lynx-js/types',
      /^@lynx-js\//,
    ],
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            // The shim is imported for side effects only (no exports).
            // Without this, the bundler tree-shakes it away.
            test: /polyfill[\\/]shim/,
            sideEffects: true,
          },
        ],
      },
    },
  },
  plugins: [pluginPublint()],
  performance: {
    buildCache: false,
  },
});
