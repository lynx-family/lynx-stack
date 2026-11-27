// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Types of the npm modules that the stand-ins import. None of them ships its
// own declarations.

declare module '@napi-rs/wasm-runtime/fs' {
  type MemFs = typeof import('@rspack/browser').builtinMemFs;

  /** The Buffer polyfill that memfs uses. */
  export const Buffer: typeof import('node:buffer').Buffer;
  /**
   * A memfs instance that this module creates when it loads. It is not the
   * one Rspack reads (`builtinMemFs.fs`), but both come from the same memfs
   * code, so they share what memfs defines once per module: `constants`,
   * `Stats`, `Dirent` and the like.
   */
  export const fs: MemFs['fs'] & {
    F_OK: number;
    R_OK: number;
    W_OK: number;
    X_OK: number;
  };
  /** Creates a memfs instance. */
  export const memfs: MemFs['memfs'];
}

declare module 'assert/build/assert.js' {
  // The npm package follows the `assert` of an older Node.js: it has no
  // `CallTracker`, `partialDeepStrictEqual` or `Assert`.
  import assert = require('node:assert');

  export = assert;
}

declare module 'events/events.js' {
  import EventEmitter = require('node:events');

  export = EventEmitter;
}

declare module 'path-browserify' {
  import type { PlatformPath } from 'node:path';

  /** The POSIX half of `node:path`, with the internal `_makeLong`. */
  const posix:
    & Omit<
      PlatformPath,
      'posix' | 'win32' | 'toNamespacedPath' | 'matchesGlob'
    >
    & { _makeLong(path: string): string };

  export = posix;
}
