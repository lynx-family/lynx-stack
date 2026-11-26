// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// POSIX paths everywhere: the kit always runs on a POSIX-like memfs.
const posix = require('path-browserify');

const path = { ...posix };
path.posix = path;
// Only used to split or compare separators; memfs paths never contain `\\`.
path.win32 = { ...posix, sep: '\\', delimiter: ';' };
path.toNamespacedPath = (p) => p;
path.default = path;
module.exports = path;
