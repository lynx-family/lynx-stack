// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const fs = require('node:fs');
const path = require('node:path');

const LOADER_RUNTIME = fs.readFileSync(
  path.resolve(__dirname, './runtime/loader.cjs'),
  'utf-8',
);

const REFRESH_RUNTIME_ABS = path.resolve(__dirname, './runtime/refresh.mjs');

const RefreshHotLoader = function RefreshHotLoader(source, inputSourceMap) {
  // Inject `__prefresh_utils__` as a real ESM import (not `ProvidePlugin`): only
  // harmony edges are async-awaited, so the footer sees resolved
  // `isComponent`/`flush` under async externals. Relative request keeps the
  // bundler-derived binding name stable across machines/snapshots.
  let request = path
    .relative(path.dirname(this.resourcePath), REFRESH_RUNTIME_ABS)
    .replace(/\\/g, '/');
  if (!request.startsWith('.')) {
    request = './' + request;
  }
  const importPrefreshUtils = `\nimport * as __prefresh_utils__ from ${
    JSON.stringify(request)
  };\n`;
  this.callback(
    null,
    source + '\n\n' + LOADER_RUNTIME + importPrefreshUtils,
    inputSourceMap,
  );
};

module.exports = RefreshHotLoader;
