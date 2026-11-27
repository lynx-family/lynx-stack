// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// POSIX paths everywhere: the kit always runs on a POSIX-like memfs. Both
// `path` and `path/posix` are this module.
import posix from 'path-browserify';

type Path = typeof posix & {
  posix: Path;
  win32: typeof posix;
  toNamespacedPath: (p: string) => string;
  default: Path;
};

// The members are filled in below, as they refer to the object itself.
const path = { ...posix } as Path;
path.posix = path;
// Only used to split or compare separators; memfs paths never contain `\\`.
path.win32 = { ...posix, sep: '\\', delimiter: ';' };
path.toNamespacedPath = (p) => p;
// `require('path').default` is the module itself, as before.
path.default = path;

export const {
  resolve,
  normalize,
  isAbsolute,
  join,
  relative,
  _makeLong,
  dirname,
  basename,
  extname,
  format,
  parse,
  sep,
  delimiter,
  win32,
  toNamespacedPath,
} = path;
export { path as posix };
export default path;
