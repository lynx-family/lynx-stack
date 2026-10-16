// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const fs = require('node:fs');
const path = require('node:path');

const { transformMarked } = require('./transform.cjs');

module.exports = function markedUnicodeLoader(source) {
  const manifest = path.resolve(
    path.dirname(this.resourcePath),
    '../package.json',
  );
  this.addDependency(manifest);
  const { name, version } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (name !== 'marked') {
    throw new Error(
      `Marked Unicode loader received an unexpected package: ${name}`,
    );
  }
  const result = transformMarked(source, version, this.resourcePath);
  this.callback(null, result.code, result.map);
};
