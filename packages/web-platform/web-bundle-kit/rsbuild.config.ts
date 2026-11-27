// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Builds the kit into `dist/` for a module Worker:
//
// - `index.js` and its chunks: Rsbuild, the Lynx plugins and @rspack/browser,
//   with Node.js built-ins replaced by the stand-ins in `src/node`.
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

import { defineConfig, rspack } from '@rsbuild/core';
import type { RsbuildConfig } from '@rsbuild/core';

import { builtinAliases } from './scripts/builtins.ts';
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

const builtinPackages: Record<string, string> = {};
for (const instance of layout.instances()) {
  if (runtimeRoots.includes(instance.realDir)) {
    builtinPackages[instance.name] = instance.version;
  }
}

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

const config: RsbuildConfig = defineConfig({
  // Not taken from NODE_ENV: the kit is always a production build.
  mode: 'production',
  source: {
    entry: { index: './src/index.ts' },
    // Only the kit's own TypeScript goes through SWC. Rsbuild compiles every
    // script outside `node_modules` by default, and the workspace packages
    // the kit bundles are outside it.
    exclude: [{ not: src }],
  },
  resolve: {
    alias: {
      // Every Node.js built-in goes to its stand-in (scripts/builtins.ts), or
      // to an empty module. `node:` is stripped first, below.
      ...builtinAliases(root),
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
    target: 'web-worker',
    module: true,
    // `index.js` is the entry the kit's users import, next to `mirror.json`.
    // The chunks' names are set below.
    distPath: { root: 'dist', js: '', assets: 'assets', wasm: 'assets' },
    filename: { js: '[name].js' },
    // `setup` loads `mirror.json` relative to `__webpack_public_path__`, and
    // the kit is served from wherever its user puts it.
    assetPrefix: 'auto',
    // Plugins stringify functions of the bundled code; a minifier renames
    // what those functions refer to.
    minify: false,
    sourceMap: false,
  },
  // Shared code of the async chunks (the ReactLynx transform is used by
  // several loaders) goes to shared chunks instead of being copied.
  splitChunks: { chunks: 'async' },
  tools: {
    // The kit's own code is compiled to a fixed ES version, not lowered for
    // Rsbuild's default browsers (that would rewrite rest parameters, for
    // one).
    swc: { jsc: { target: 'es2022' } },
    rspack: {
      // The exports of `index.js` are the kit's API. Without a library type,
      // Rspack treats them as unused and drops the chunks they import.
      output: {
        library: { type: 'module' },
        // Hashed, unlike `index.js`. Rsbuild gives chunks the name of the
        // entry.
        chunkFilename: 'chunks/[id].[contenthash:8].js',
        // Rsbuild makes Rspack declare module bindings with `var`; `const`
        // keeps the temporal dead zone of the original modules.
        environment: { const: true },
      },
      // `global` stays the Worker's own (src/node/globals.ts). With
      // `output.module`, Rsbuild already leaves `__dirname` and `__filename`
      // alone; the kit's plugin sets them for bundled packages.
      node: { global: false },
      module: {
        parser: {
          javascript: {
            // Rsbuild makes `import()` eager in a Web Worker; the kit loads
            // its chunks when they are needed.
            dynamicImportMode: 'lazy',
            // `createRequire(import.meta.url)` stays a call to the stand-in.
            createRequire: false,
            // Let `require(variable)` reach the stand-in without a warning.
            exprContextCritical: false,
            unknownContextCritical: false,
          },
        },
      },
      optimization: {
        // Rsbuild sets NODE_ENV for the project at run time; the kit must not
        // freeze it at build time.
        nodeEnv: false,
      },
      plugins: [
        // Rspack treats `node:` as a URL scheme before aliases apply.
        new rspack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.slice('node:'.length);
        }),
      ],
    },
  },
  // 4. The kit's plugin: the registered modules, the rewrite of every bundled
  // module and the mirror, from the layout, the lists above and the defines.
  plugins: [
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
