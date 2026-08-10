/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import path from 'pathe';

/**
 * `@import` href resolution, without `node:path`.
 *
 * This module used to `import path from 'node:path'`. Because `parse` imports
 * `generateHref`, that single import made the whole package impossible to bundle
 * for a browser, and the package exposes no subpath exports to import around it.
 * `pathe` provides the four functions this file needs - `join`, `resolve`,
 * `relative` and `isAbsolute` - and works in both a browser bundle and Node.
 *
 * ## What is unchanged, and what is not
 *
 * For a path that contains no backslash, `pathe` is byte-identical to
 * `path.posix`, which is what `node:path`'s default export already was on every
 * non-Windows platform. Since `parse` defaults `projectRoot` to `'/'` and every
 * in-repo caller passes POSIX paths, href resolution is unchanged in this tree.
 * `test/generateHref.test.ts` proves that against `node:path` itself over a
 * generated matrix.
 *
 * A path that *does* contain a backslash is where `pathe` differs, because it
 * treats `\` as a separator by design:
 *
 * - `'\a.css'` is an absolute path, not a filename starting with a backslash.
 * - `'C:\x.css'` has a drive letter, so `C:` is a path segment rather than part
 *   of a filename.
 * - `'\\srv\share'` is a UNC-shaped path.
 *
 * That is neither `path.posix` (which treats `\` as an ordinary character) nor
 * exactly `path.win32` (which differs again on UNC and on a leading `\`). The
 * behaviour these inputs get is pinned in `test/generateHref.test.ts` rather
 * than described here, so it cannot drift silently.
 *
 * ## A relative `projectRoot`
 *
 * `pathe` has no `process.cwd()` to fall back to, so a relative `projectRoot` is
 * treated as rooted. `node:path` resolved it against the working directory,
 * which made the old output depend on where the build ran from. Nothing in this
 * tree observes the difference: `parse` defaults `projectRoot` to `'/'`, and
 * every in-repo caller passes an absolute one.
 */

export function getFullPath(
  projectRoot: string,
  filename: string,
  importStmt: string,
): string {
  let fullPath = '';
  if (importStmt.startsWith('/')) {
    fullPath = path.join(projectRoot, importStmt);
  } else if (importStmt.startsWith('@')) {
    fullPath = importStmt;
  } else {
    fullPath = path.resolve(filename, '..', importStmt);
  }

  return fullPath;
}

export function generateHref(
  projectRoot: string,
  filename: string,
  origin: string,
): string {
  filename = path.isAbsolute(filename)
    ? filename
    : path.join(projectRoot, filename);
  const fullPath = getFullPath(projectRoot, filename, origin);

  let projectPath = path.relative(projectRoot, fullPath);

  if (fullPath.startsWith('@')) {
    return normalizeSlashes(fullPath);
  } else if (!projectPath.startsWith('.')) {
    projectPath = path.join(POSIX_SEP, projectPath);
  }

  return normalizeSlashes(projectPath);
}

/** `path.posix.sep`. */
const POSIX_SEP = '/';

/** `path.win32.sep`, kept out of shipped hrefs. */
const WIN32_SEP = '\\';

function normalizeSlashes(file: string) {
  return file.replaceAll(WIN32_SEP, '/');
}
