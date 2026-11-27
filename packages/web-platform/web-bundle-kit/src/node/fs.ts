// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// `fs` is the memfs of @rspack/browser: the file system Rspack reads. It
// exists only after setup (../setup.ts), and it is not the memfs instance
// that @napi-rs/wasm-runtime/fs creates when it loads, so the members look it
// up when they are used (see `forwardMembers`).
//
// The named exports are every key of a memfs `fs`.

import { memfs as createMemfs, fs as shared } from '@napi-rs/wasm-runtime/fs';

import promises from './fs-promises.js';
import { memfs } from './host.js';
import { forwardMembers } from './lazy.js';
import type { Class } from './lazy.js';

/** Typed as Node.js's, with the members memfs adds. */
type MemfsModule =
  & typeof import('node:fs')
  & Record<
    'StatWatcher' | 'FSWatcher' | 'FileReadStream' | 'FileWriteStream',
    Class
  >
  & Record<'F_OK' | 'R_OK' | 'W_OK' | 'X_OK', number>
  & { _toUnixTimestamp: (time: unknown) => number; __vol: object };

const fs = {
  ...forwardMembers(shared, createMemfs().fs, memfs),
  promises,
} as unknown as MemfsModule;

export const {
  F_OK,
  R_OK,
  W_OK,
  X_OK,
  constants,
  Stats,
  Dir,
  Dirent,
  accessSync,
  appendFileSync,
  chmodSync,
  chownSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  fchmodSync,
  fchownSync,
  fdatasyncSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  futimesSync,
  globSync,
  lchmodSync,
  lchownSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  readvSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statfsSync,
  statSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  utimesSync,
  lutimesSync,
  writeFileSync,
  writeSync,
  writevSync,
  access,
  appendFile,
  chmod,
  chown,
  close,
  copyFile,
  cp,
  createReadStream,
  createWriteStream,
  exists,
  fchmod,
  fchown,
  fdatasync,
  fstat,
  fsync,
  ftruncate,
  futimes,
  glob,
  lchmod,
  lchown,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  openAsBlob,
  opendir,
  read,
  readv,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  statfs,
  symlink,
  truncate,
  unlink,
  unwatchFile,
  utimes,
  lutimes,
  watch,
  watchFile,
  write,
  writev,
  writeFile,
  StatWatcher,
  FSWatcher,
  ReadStream,
  WriteStream,
  FileReadStream,
  FileWriteStream,
  _toUnixTimestamp,
  __vol,
} = fs;
export { promises };
export default fs;
