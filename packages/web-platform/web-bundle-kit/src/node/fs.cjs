// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `fs` is the memfs of @rspack/browser: the file system Rspack reads.
const host = require('./host.cjs');
const lazyObject = require('./lazy.cjs');

module.exports = lazyObject(() => {
  if (!host.fs) throw new Error('web-bundle-kit: fs was used before setup');
  return host.fs;
});
