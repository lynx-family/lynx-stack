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
// See ../README.md for the rules this follows.

import {
  globSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';

import { createLayout, findPackageRoot } from './layout.mjs';
import { collectMirror } from './mirror.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const generated = path.join(root, 'generated');
const require = createRequire(path.join(root, 'package.json'));

/** The real directory of a package, looked up from another package. */
function packageDir(name, from = root) {
  const fromRequire = createRequire(path.join(from, 'package.json'));
  let entry;
  try {
    entry = fromRequire.resolve(`${name}/package.json`);
  } catch {
    entry = fromRequire.resolve(name);
  }
  return realpathSync(findPackageRoot(entry));
}

const dirs = {};
dirs.rsbuild = packageDir('@rsbuild/core');
dirs.pluginLynx = packageDir('@lynx-js/rsbuild-plugin');
dirs.pluginReact = packageDir('@lynx-js/react-rsbuild-plugin');
dirs.react = packageDir('@lynx-js/react');
dirs.rspackBrowser = packageDir('@rspack/browser');
dirs.napiRuntime = packageDir('@napi-rs/wasm-runtime', dirs.rspackBrowser);
dirs.reactWebpackPlugin = packageDir(
  '@lynx-js/react-webpack-plugin',
  dirs.pluginReact,
);
dirs.cssExtract = packageDir(
  '@lynx-js/css-extract-webpack-plugin',
  dirs.pluginReact,
);
dirs.reactRefresh = packageDir(
  '@lynx-js/react-refresh-webpack-plugin',
  dirs.pluginReact,
);
dirs.chunkLoading = packageDir(
  '@lynx-js/chunk-loading-webpack-plugin',
  dirs.pluginLynx,
);

// The packages a project gets for free, in addition to everything the
// bundled plugins depend on.
const runtimeRoots = [dirs.react];
const layout = createLayout([
  dirs.rsbuild,
  dirs.pluginLynx,
  dirs.pluginReact,
  ...runtimeRoots,
]);
if (layout.missing.length > 0) {
  throw new Error(`Unresolved dependencies:\n  ${layout.missing.join('\n  ')}`);
}

// Modules Rspack or `require()` load by path at build time: the loaders and
// the ReactLynx transform. They are bundled into the kit and registered under
// their virtual path (see src/node/module.cjs and BrowserRequirePlugin).
const registered = [
  [dirs.rsbuild, 'dist/transformLoader.mjs'],
  [dirs.rsbuild, 'dist/transformRawLoader.mjs'],
  [dirs.rsbuild, 'dist/cssUrlLoader.mjs'],
  [dirs.rsbuild, 'dist/ignoreCssLoader.mjs'],
  [dirs.rsbuild, 'compiled/css-loader/index.js'],
  // Required by Rsbuild whether or not HTML is generated.
  [dirs.rsbuild, 'compiled/html-rspack-plugin/index.js'],
  [dirs.pluginReact, 'lib/loaders/ignore-css-loader.js'],
  [dirs.pluginReact, 'lib/loaders/invalid-import-error-loader.js'],
  [dirs.reactWebpackPlugin, 'lib/loaders/background.js'],
  [dirs.reactWebpackPlugin, 'lib/loaders/main-thread.js'],
  [dirs.reactWebpackPlugin, 'lib/loaders/testing.js'],
  [dirs.cssExtract, 'lib/rspack-loader.js'],
  [dirs.reactRefresh, 'loader.cjs'],
  [dirs.react, 'transform/cjs/browser.cjs'],
].map(([dir, file]) => path.join(dir, file));

// Modules whose functions a plugin injects into cards as source text, with
// `Template.getFunctionContent(fn)` (`fn.toString()`). Bundling the kit
// would rewrite that text (it renames `__webpack_require__`, for one), so
// scripts/verbatim-functions-loader.cjs gives each top-level function of
// these modules a `toString` that returns its text as published. Patterns are
// globs relative to the package; each must match files, and every matched
// file must end up in the kit.
const STRINGIFIED = [
  // `generateFromTemplate` in lib/runtime/helper.js, for JavaScriptRuntimeModule
  // and CssRuntimeModule.
  [dirs.chunkLoading, 'lib/runtime/javascript/*.js'],
  [dirs.chunkLoading, 'lib/runtime/css/*.js'],
  // MainThreadHMR (dual-thread hot updates; not used for web builds today).
  [dirs.reactWebpackPlugin, 'lib/runtime/hmr-*.js'],
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

// Write the module that registers them. Paths are relative to `generated/`,
// so the build does not depend on where the repository is checked out.
mkdirSync(generated, { recursive: true });
writeFileSync(
  path.join(generated, 'registered.js'),
  [
    '// Generated by scripts/build.mjs. Do not edit.',
    'export const registered = {',
    ...registered.map((file) => {
      const virtual = layout.toVirtual(file);
      if (!virtual) {
        throw new Error(`${file} is not in the virtual node_modules tree`);
      }
      const request = path.relative(generated, file).split(path.sep).join('/');
      return `  ${JSON.stringify(virtual)}: () => import(${
        JSON.stringify(request)
      }),`;
    }),
    '};',
    '',
  ].join('\n'),
);

writeFileSync(
  path.join(generated, 'registered.d.ts'),
  [
    '// Generated by scripts/build.mjs. Do not edit.',
    'export declare const registered: Record<string, () => Promise<unknown>>;',
    '',
  ].join('\n'),
);

// Every Node.js built-in goes to src/node; `node:` is stripped first, since
// Rspack treats it as a URL scheme before aliases apply.
const builtinStandIn = path.join(root, 'src/node/builtin.cjs');
const alias = {};
for (const name of builtinModules.filter((n) => !n.startsWith('_'))) {
  alias[`${name}$`] = `${builtinStandIn}?${name}`;
}
Object.assign(alias, {
  '@rspack/core$': path.join(dirs.rspackBrowser, 'dist/index.js'),
  '@napi-rs/wasm-runtime/fs$': path.join(dirs.napiRuntime, 'dist/fs.js'),
  // Optional minimizers that css-minimizer-webpack-plugin may require; none of
  // them exist in a browser.
  'clean-css$': false,
  'csso$': false,
  'esbuild$': false,
  'lightningcss$': false,
  '@parcel/css$': false,
  '@swc/css$': false,
});

const builtinPackages = {};
for (const instance of layout.instances()) {
  if (runtimeRoots.includes(instance.realDir)) {
    builtinPackages[instance.name] = instance.version;
  }
}

/** @param {string} file */
const isCommonJS = (file) => {
  if (file.endsWith('.cjs')) return true;
  if (file.endsWith('.mjs') || file.endsWith('.ts')) return false;
  const pkgRoot = findPackageRoot(file);
  if (!pkgRoot) return true;
  return JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf-8'))
    .type !== 'module';
};

globalThis.__webBundleKitBuild = {
  toVirtual: (file) => layout.toVirtual(file),
  isCommonJS,
};

rmSync(dist, { recursive: true, force: true });

const compiler = rspack({
  mode: 'production',
  target: 'webworker',
  context: root,
  devtool: false,
  entry: { index: './src/index.ts' },
  output: {
    path: dist,
    module: true,
    chunkFormat: 'module',
    chunkLoading: 'import',
    workerChunkLoading: 'import',
    library: { type: 'module' },
    filename: '[name].js',
    chunkFilename: 'chunks/[id].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
    webassemblyModuleFilename: 'assets/[hash].module.wasm',
    publicPath: 'auto',
    environment: { dynamicImport: true, module: true },
  },
  experiments: { asyncWebAssembly: true },
  resolve: {
    alias,
    extensionAlias: { '.js': ['.ts', '.js'] },
    extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
  },
  node: { global: false, __dirname: false, __filename: false },
  module: {
    parser: {
      javascript: {
        // `createRequire(import.meta.url)` stays a call to the stand-in.
        createRequire: false,
        // Let `require(variable)` reach the stand-in without a warning.
        exprContextCritical: false,
        unknownContextCritical: false,
      },
    },
    rules: [
      {
        test: /\.ts$/,
        include: path.join(root, 'src'),
        loader: 'builtin:swc-loader',
        options: {
          jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.[cm]?js$/,
        exclude: [
          path.join(root, 'src'),
          dirs.rspackBrowser,
          dirs.napiRuntime,
          generated,
        ],
        enforce: 'pre',
        loader: path.join(root, 'scripts/virtual-path-loader.cjs'),
        // The loader reads `layout` and `isCommonJS` from here; Rspack
        // passes loader options through JSON.
        options: { key: 'web-bundle-kit' },
      },
      {
        // Listed after virtual-path-loader, so it runs first, on the
        // published text.
        include: stringified,
        enforce: 'pre',
        loader: path.join(root, 'scripts/verbatim-functions-loader.cjs'),
      },
    ],
  },
  optimization: {
    // Rsbuild sets NODE_ENV for the project at run time; the kit must not
    // freeze it at build time.
    nodeEnv: false,
    minimize: false,
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    // Shared code of the async chunks (the ReactLynx transform is used by
    // several loaders) goes to shared chunks instead of being copied.
    splitChunks: { chunks: 'async' },
  },
  performance: { hints: false },
  plugins: [
    new rspack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.slice('node:'.length);
    }),
    new rspack.DefinePlugin({
      __BUILTIN_PACKAGES__: JSON.stringify(builtinPackages),
      // There is no native `require` in a Worker. Without this, Rspack turns
      // emnapi's `__non_webpack_require__` into an import of `node:module`.
      __non_webpack_require__: 'undefined',
    }),
  ],
});

const stats = await new Promise((resolve, reject) => {
  compiler.run((error, result) => {
    if (error) reject(error);
    else resolve(result);
  });
});
const json = stats.toJson({
  all: false,
  errors: true,
  warnings: true,
  modules: true,
});
for (const warning of json.warnings) {
  console.warn(
    'WARNING',
    warning.moduleName ?? '',
    warning.message.split('\n').slice(0, 4).join('\n  '),
  );
}
if (json.errors.length > 0) {
  for (const error of json.errors) {
    console.error(
      'ERROR',
      error.moduleName ?? '',
      error.message.split('\n').slice(0, 6).join('\n  '),
    );
  }
  process.exitCode = 1;
} else {
  // The mirror: placeholders for every bundled module, so that resolving them
  // in memfs succeeds, and the real content of runtime packages.
  const bundled = new Set();
  for (const module of stats.compilation.modules) {
    const resource = module.resource?.split('?')[0];
    if (resource) bundled.add(resource);
  }
  const unused = stringified.filter((file) => !bundled.has(file));
  if (unused.length > 0) {
    throw new Error(
      `STRINGIFIED lists files the kit does not bundle (stale entries, or the plugin moved them):\n  ${
        unused.join('\n  ')
      }`,
    );
  }
  const mirror = collectMirror({ layout, bundled, dirs });
  writeFileSync(path.join(dist, 'mirror.json'), JSON.stringify(mirror));
  console.log(
    `dist: ${
      Object.keys(mirror.files).length
    } mirrored files, builtin packages ${JSON.stringify(builtinPackages)}`,
  );
}
await new Promise((resolve) => compiler.close(resolve));
void require;
