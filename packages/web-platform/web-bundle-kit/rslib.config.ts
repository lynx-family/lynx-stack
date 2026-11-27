// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Builds the kit into `dist/` for a module Worker:
//
// - `index.js` and its chunks: Rsbuild, the Lynx plugins and @rspack/browser,
//   with Node.js built-ins replaced as scripts/builtins.ts says.
// - `mirror.json`: the files the kit puts under `/node_modules` in memfs.
// - the Rspack wasm and its thread worker, as assets.
//
// The layout of the virtual `node_modules` tree is computed once, below. The
// kit's plugin (scripts/plugin.ts) takes it to register the loaders, to give
// every bundled module its virtual location and to write the mirror, so the
// three agree. See README.md for the rules this follows.

import { globSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { defineConfig } from '@rslib/core';
import type { RslibConfig } from '@rslib/core';

import { builtinAliases, nodePolyfillOptions } from './scripts/builtins.ts';
import { createLayout, packageDir } from './scripts/layout.ts';
import { pluginWebBundleKit } from './scripts/plugin.ts';

// Real, like the paths Rspack resolves to, so that the conditions on `root`
// below match when the checkout is reached through a symbolic link or a
// junction.
const root = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'src');

const rsbuildDir = packageDir('@rsbuild/core', root);
const pluginLynxDir = packageDir('@lynx-js/rsbuild-plugin', root);
const pluginReactDir = packageDir('@lynx-js/react-rsbuild-plugin', root);
const reactDir = packageDir('@lynx-js/react', root);
const rspackBrowserDir = packageDir('@rspack/browser', root);
const napiRuntimeDir = packageDir('@napi-rs/wasm-runtime', rspackBrowserDir);
const reactWebpackPluginDir = packageDir(
  '@lynx-js/react-webpack-plugin',
  pluginReactDir,
);
const cssExtractDir = packageDir(
  '@lynx-js/css-extract-webpack-plugin',
  pluginReactDir,
);
const reactRefreshDir = packageDir(
  '@lynx-js/react-refresh-webpack-plugin',
  pluginReactDir,
);
const chunkLoadingDir = packageDir(
  '@lynx-js/chunk-loading-webpack-plugin',
  pluginLynxDir,
);

// 1. The layout: a place under `/node_modules` for every package the kit
// bundles or provides. The runtime roots are the packages a project gets for
// free, in addition to everything the bundled plugins depend on.
const runtimeRoots = [reactDir];
const layout = createLayout([
  rsbuildDir,
  pluginLynxDir,
  pluginReactDir,
  ...runtimeRoots,
]);
if (layout.missing.length > 0) {
  throw new Error(`Unresolved dependencies:\n  ${layout.missing.join('\n  ')}`);
}

const builtinPackages = Object.fromEntries(
  layout.instances()
    .filter((instance) => runtimeRoots.includes(instance.realDir))
    .map((instance) => [instance.name, instance.version]),
);

// 2. Modules Rspack or `require()` load by path at build time: the loaders and
// the ReactLynx transform. They are bundled into the kit and registered under
// their virtual path (see src/registered.ts, src/node/module.ts and
// BrowserRequirePlugin).
const REGISTERED = [
  [rsbuildDir, 'dist/transformLoader.mjs'],
  [rsbuildDir, 'dist/transformRawLoader.mjs'],
  [rsbuildDir, 'dist/cssUrlLoader.mjs'],
  [rsbuildDir, 'dist/ignoreCssLoader.mjs'],
  [rsbuildDir, 'compiled/css-loader/index.js'],
  // Required by Rsbuild whether or not HTML is generated.
  [rsbuildDir, 'compiled/html-rspack-plugin/index.js'],
  [pluginReactDir, 'lib/loaders/ignore-css-loader.js'],
  [pluginReactDir, 'lib/loaders/invalid-import-error-loader.js'],
  [reactWebpackPluginDir, 'lib/loaders/background.js'],
  [reactWebpackPluginDir, 'lib/loaders/main-thread.js'],
  [reactWebpackPluginDir, 'lib/loaders/testing.js'],
  [cssExtractDir, 'lib/rspack-loader.js'],
  [reactRefreshDir, 'loader.cjs'],
  [reactDir, 'transform/cjs/browser.cjs'],
].map(([dir, file]) => path.join(dir!, file!));

// 3. Modules whose functions a plugin injects into cards as source text, with
// `Template.getFunctionContent(fn)` (`fn.toString()`). Bundling the kit would
// rewrite that text (it renames `__webpack_require__`, for one), so
// scripts/verbatim-functions.ts gives each top-level function of these
// modules a `toString` that returns its text as published. Patterns are globs
// relative to the package; each must match files, and every matched file must
// end up in the kit.
const STRINGIFIED: [dir: string, pattern: string][] = [
  // `generateFromTemplate` in lib/runtime/helper.js, for JavaScriptRuntimeModule
  // and CssRuntimeModule.
  [chunkLoadingDir, 'lib/runtime/javascript/*.js'],
  [chunkLoadingDir, 'lib/runtime/css/*.js'],
  // MainThreadHMR (dual-thread hot updates; not used for web builds today).
  [reactWebpackPluginDir, 'lib/runtime/hmr-*.js'],
];
const stringified = STRINGIFIED.flatMap(([dir, pattern]) => {
  const files = globSync(pattern, { cwd: dir }).sort().map((file) =>
    path.join(dir, file)
  );
  if (files.length === 0) {
    throw new Error(`STRINGIFIED: ${pattern} matches nothing in ${dir}`);
  }
  return files;
});

const polyfillOptions = nodePolyfillOptions(root);

// Rslib builds a library for other bundlers and Node.js; the kit is a
// program that runs as it is in a Worker. The options below that differ from
// Rslib's defaults say why.
const config: RslibConfig = defineConfig({
  lib: [{
    format: 'esm',
    // Everything is bundled: nothing is left for a consumer to install.
    output: { autoExternal: false },
  }],
  source: {
    entry: { index: './src/index.ts' },
    // Only the kit's own TypeScript goes through SWC. Rsbuild compiles every
    // script outside `node_modules` by default, and the workspace packages
    // the kit bundles are outside it.
    exclude: [{ not: src }],
  },
  resolve: {
    alias: {
      // What each Node.js built-in becomes (scripts/builtins.ts).
      ...builtinAliases(polyfillOptions),
      '@rspack/core$': path.join(rspackBrowserDir, 'dist/index.js'),
      '@napi-rs/wasm-runtime/fs$': path.join(napiRuntimeDir, 'dist/fs.js'),
      // Optional minimizers that css-minimizer-webpack-plugin may require;
      // none of them exist in a browser.
      'clean-css$': false,
      'csso$': false,
      'esbuild$': false,
      'lightningcss$': false,
      '@parcel/css$': false,
      '@swc/css$': false,
    },
  },
  output: {
    target: 'web',
    // `index.js` is the entry the kit's users import, next to `mirror.json`.
    // The chunks' names are set below.
    distPath: { assets: 'assets', wasm: 'assets' },
    // The kit is served as it is: the name of an asset changes with its
    // content.
    filename: { assets: '[name].[contenthash:10][ext]' },
    // Plugins stringify functions of the bundled code; a minifier renames
    // what those functions refer to.
    minify: false,
  },
  // Every build starts from the sources and writes nothing outside `dist/`.
  performance: { buildCache: false },
  tools: {
    rspack: {
      output: {
        // Not Rslib's `modern-module`: it gives the chunk of a dynamically
        // imported module an ES module facade, and writes the export
        // `"module.exports"` of @rspack/browser as the member path
        // `.module.exports`, so `import('@rspack/browser')` throws. The chunks
        // of a `module` library are ES modules too, which Rslib turns off
        // with `modern-module`.
        library: { type: 'module' },
        chunkFormat: 'module',
        // Hashed, unlike `index.js`, and out of its way.
        chunkFilename: 'chunks/[id].[contenthash:8].js',
      },
      // `global` stays the Worker's own (src/node/globals.ts). The kit's
      // plugin sets `__dirname` and `__filename` for bundled packages.
      node: { global: false },
      module: {
        parser: {
          javascript: {
            // Rslib leaves these calls for the bundler or the Node.js of a
            // library's consumer. In the kit, `import(expression)` and
            // `require(expression)` reject or throw `MODULE_NOT_FOUND`, as
            // they did when the kit was built with Rsbuild, instead of
            // fetching a URL or failing on a missing `require`.
            importDynamic: true,
            requireDynamic: true,
            requireAsExpression: true,
            // `require.resolve('./file')` gives the id of the bundled module.
            requireResolve: true,
            // `createRequire(import.meta.url)` stays a call to the stand-in.
            createRequire: false,
            // Let `require(variable)` reach the stand-in without a warning.
            exprContextCritical: false,
            unknownContextCritical: false,
          },
        },
      },
    },
  },
  plugins: [
    // Strips `node:` from requests. Its `resolve.fallback` is the aliases
    // above.
    pluginNodePolyfill(polyfillOptions),
    // 4. The kit's plugin: the registered modules, the rewrite of every bundled
    // module and the mirror, from the layout, the lists above and the defines.
    pluginWebBundleKit({
      layout,
      registered: {
        stub: path.join(src, 'registered.ts'),
        files: REGISTERED,
      },
      stringified,
      keepLocation: [src, rspackBrowserDir, napiRuntimeDir],
      define: {
        __BUILTIN_PACKAGES__: JSON.stringify(builtinPackages),
        // There is no native `require` in a Worker. Without this, Rspack turns
        // emnapi's `__non_webpack_require__` into an import of `node:module`.
        __non_webpack_require__: 'undefined',
      },
    }),
  ],
});

export default config;
