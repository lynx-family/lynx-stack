// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// `fs/promises`, and `promises` of `fs`: the promise API of the memfs of
// @rspack/browser. As in ./fs.ts, the members look the memfs up when they
// are used.
//
// The named exports are every key of a memfs `fs.promises`.

import { memfs as createMemfs, fs as shared } from '@napi-rs/wasm-runtime/fs';

import { memfs } from './host.js';
import { forwardMembers } from './lazy.js';
import type { Class } from './lazy.js';

/** Typed as Node.js's, with the members memfs adds. */
type MemfsPromises =
  & typeof import('node:fs/promises')
  & { fs: object; FileHandle: Class };

const fsPromises = forwardMembers(
  shared.promises,
  createMemfs().fs.promises,
  () => memfs().promises,
) as unknown as MemfsPromises;

export const {
  fs,
  FileHandle,
  constants,
  cp,
  copyFile,
  opendir,
  statfs,
  lutimes,
  glob,
  access,
  chmod,
  chown,
  lchmod,
  lchown,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readlink,
  realpath,
  rename,
  rmdir,
  rm,
  stat,
  symlink,
  truncate,
  unlink,
  utimes,
  readFile,
  appendFile,
  open,
  writeFile,
  watch,
} = fsPromises;
export default fsPromises;
