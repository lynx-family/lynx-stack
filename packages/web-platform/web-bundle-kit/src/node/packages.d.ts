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

declare module 'assert/build/internal/util/comparisons.js' {
  /** What `util.isDeepStrictEqual` is in Node.js. */
  export function isDeepStrictEqual(a: unknown, b: unknown): boolean;
}

declare module 'util/util.js' {
  type NodeUtil = typeof import('node:util');
  type Check = (value: unknown) => boolean;

  /** The npm `util`: the `util` of an older Node.js. */
  const util:
    & Pick<
      NodeUtil,
      | 'format'
      | 'deprecate'
      | 'debuglog'
      | 'inspect'
      | 'isArray'
      | 'inherits'
      | 'promisify'
      | 'callbackify'
    >
    & Record<
      | 'isBoolean'
      | 'isNull'
      | 'isNullOrUndefined'
      | 'isNumber'
      | 'isString'
      | 'isSymbol'
      | 'isUndefined'
      | 'isRegExp'
      | 'isObject'
      | 'isDate'
      | 'isError'
      | 'isFunction'
      | 'isPrimitive'
      | 'isBuffer',
      Check
    >
    & {
      log(...args: unknown[]): void;
      _extend<T extends object>(target: T, source: object): T;
      /** Every check of `node:util/types` except `isProxy` and the like. */
      types: Record<
        | 'isWebAssemblyCompiledModule'
        | Exclude<
          keyof typeof import('node:util/types'),
          | 'isProxy'
          | 'isExternal'
          | 'isModuleNamespaceObject'
          | 'isKeyObject'
          | 'isCryptoKey'
          | 'isFloat16Array'
        >,
        Check
      >;
    };

  export default util;
}

declare module 'url/url.js' {
  type NodeUrl = typeof import('node:url');

  /** The npm `url`: the legacy API of `node:url`. */
  const url: Pick<
    NodeUrl,
    'Url' | 'parse' | 'resolve' | 'resolveObject' | 'format'
  >;

  export default url;
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
