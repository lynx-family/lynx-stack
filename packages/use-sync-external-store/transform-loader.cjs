// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

// A minimal rspack loader that runs `transformReactLynxSync` on test and src
// files, mirroring the `test`-mode options of the ReactLynx testing-library
// transform plugin.
//
// It imports `@lynx-js/react/transform` directly instead of
// `@lynx-js/react-rsbuild-plugin`, so it does NOT pull
// `react-rsbuild-plugin` into use-sync's build graph (avoiding a turbo build
// cycle, since react-rsbuild-plugin transitively depends on use-sync).

const path = require('node:path');

const { transformReactLynxSync } = require('@lynx-js/react/transform');

const runtimePkgName = '@lynx-js/react';

function normalizeSlashes(file) {
  return file.replaceAll(path.win32.sep, '/');
}

/**
 * @this {import('@rspack/core').LoaderContext}
 * @param {string} source
 */
module.exports = function transformLoader(source) {
  const callback = this.async();
  const sourcePath = this.resourcePath;

  const relativePath = normalizeSlashes(
    path.relative(this.rootContext, sourcePath),
  );
  const basename = path.basename(sourcePath);

  const result = transformReactLynxSync(source, {
    mode: 'test',
    pluginName: '',
    filename: basename,
    sourcemap: true,
    snapshot: {
      preserveJsx: false,
      runtimePkg: `${runtimePkgName}/internal`,
      jsxImportSource: runtimePkgName,
      filename: relativePath,
      target: 'MIXED',
    },
    engineVersion: '',
    dynamicImport: {
      injectLazyBundle: false,
      layer: 'test',
      runtimePkg: `${runtimePkgName}/internal`,
    },
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    worklet: {
      filename: relativePath,
      runtimePkg: `${runtimePkgName}/internal`,
      target: 'MIXED',
    },
    refresh: false,
    cssScope: false,
  });

  if (result.errors.length > 0) {
    callback(new Error(result.errors.map((e) => e.text).join('\n')));
    return;
  }

  callback(null, result.code, result.map ?? undefined);
};
