// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Paths in the build. Real paths are the platform's (`C:\...` with
// backslashes on Windows); virtual paths, `mirror.json` keys and import
// specifiers are POSIX. Every function takes the `path` module to use, so
// that test/paths.test.ts runs them with `path.win32` on any platform.

import path from 'node:path';

type PathModule = typeof path.posix;

/** A relative real path with `/` as the separator. */
export function toPosix(relative: string, p: PathModule = path): string {
  return relative.split(p.sep).join('/');
}

/**
 * The relative import specifier of `file` from a module in `fromDir`
 * (`./x.js` or `../x.js`, never with a backslash).
 */
export function relativeSpecifier(
  fromDir: string,
  file: string,
  p: PathModule = path,
): string {
  const relative = p.relative(fromDir, file);
  if (p.isAbsolute(relative)) {
    // `path.win32.relative` returns the target itself across drives.
    throw new Error(`${file} cannot be imported relatively from ${fromDir}`);
  }
  const posix = toPosix(relative, p);
  return posix.startsWith('../') ? posix : `./${posix}`;
}

/**
 * The virtual path of `realFile`, a file of the package in `realDir` that is
 * placed at `virtualDir` in the virtual tree.
 */
export function virtualPathOf(
  virtualDir: string,
  realDir: string,
  realFile: string,
  p: PathModule = path,
): string {
  return path.posix.join(virtualDir, toPosix(p.relative(realDir, realFile), p));
}

/**
 * A key under which two spellings of the same real path are equal: Windows
 * compares paths without case (`c:\` and `C:\`, for one), so the key is
 * lower case there.
 */
export function pathKey(file: string, p: PathModule = path): string {
  const resolved = p.resolve(file);
  return p.sep === '\\' ? resolved.toLowerCase() : resolved;
}

/** Whether `file` is `dir` or inside it, comparing as the platform does. */
export function isInside(
  file: string,
  dir: string,
  p: PathModule = path,
): boolean {
  const relative = p.relative(dir, file);
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${p.sep}`)
      && !p.isAbsolute(relative));
}
