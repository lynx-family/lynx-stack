// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// `fs/promises`, and `promises` of `fs`: the promise API of the memfs of
// @rspack/browser. As in ./fs.ts, the members look the memfs up when they
// are used, and what memfs defines once for all instances (`FileHandle`,
// `constants`) is taken from @napi-rs/wasm-runtime/fs.
//
// The named exports are every key of a memfs `fs.promises`.

import { fs as napiFs } from '@napi-rs/wasm-runtime/fs';

import { memfs } from './host.js';
import { forward, lazyObject } from './lazy.js';
import type { Class } from './lazy.js';

type NodeFsPromises = typeof import('node:fs/promises');

const shared = napiFs.promises;
const promisesOf = () => memfs().promises;

/** Forwards to the method `key` of the memfs; typed as Node.js's. */
function method<K extends keyof NodeFsPromises>(key: K): NodeFsPromises[K] {
  // A forwarder has the signature of the method it forwards to.
  return forward(promisesOf, key) as unknown as NodeFsPromises[K];
}

const fsPromises = {
  fs: lazyObject(() => Reflect.get(promisesOf(), 'fs') as object),
  // Typed loosely: the memfs types cannot be named from here.
  FileHandle: shared.FileHandle as unknown as Class,
  constants: shared.constants,
  cp: method('cp'),
  copyFile: method('copyFile'),
  opendir: method('opendir'),
  statfs: method('statfs'),
  lutimes: method('lutimes'),
  glob: method('glob'),
  access: method('access'),
  chmod: method('chmod'),
  chown: method('chown'),
  lchmod: method('lchmod'),
  lchown: method('lchown'),
  link: method('link'),
  lstat: method('lstat'),
  mkdir: method('mkdir'),
  mkdtemp: method('mkdtemp'),
  readdir: method('readdir'),
  readlink: method('readlink'),
  realpath: method('realpath'),
  rename: method('rename'),
  rmdir: method('rmdir'),
  rm: method('rm'),
  stat: method('stat'),
  symlink: method('symlink'),
  truncate: method('truncate'),
  unlink: method('unlink'),
  utimes: method('utimes'),
  readFile: method('readFile'),
  appendFile: method('appendFile'),
  open: method('open'),
  writeFile: method('writeFile'),
  watch: method('watch'),
};

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
