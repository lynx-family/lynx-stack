/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import path from 'path-browserify';

/**
 * `@import` href resolution, without `node:path`.
 *
 * This module used to `import path from 'node:path'`. Because `parse` imports
 * `generateHref`, that single import made the whole package impossible to bundle
 * for a browser, and the package exposes no subpath exports to import around it.
 * `path-browserify` is a drop-in that works in both a browser bundle and in
 * Node, so the four functions this file needs - `join`, `resolve`, `relative`
 * and `isAbsolute` - keep their `path.posix` behaviour without pulling in a Node
 * builtin.
 *
 * ## Why POSIX semantics
 *
 * `node:path`'s default export is `path.posix` on every non-Windows platform, so
 * POSIX is what the ReactLynx build has actually been doing, and
 * `path-browserify` is Node's own POSIX implementation ported verbatim. That
 * means, deliberately:
 *
 * - `\` is an ordinary filename character, not a separator. Only the final
 *   {@link normalizeSlashes} pass rewrites it, so `'\a.css'` still resolves to
 *   `'//a.css'` rather than `'/a.css'`, exactly as before.
 * - A drive letter is not a root. `'C:\x.css'` is a *relative* path whose first
 *   segment happens to be `'C:'`, so it resolves under `projectRoot`.
 * - A UNC path is just a name containing backslashes; `'\\srv\share'` gets no
 *   special treatment.
 *
 * On Windows the old code picked up `path.win32` and could differ - e.g.
 * `generateHref('C:\\proj', 'pages\\index.css', './a.css')` was `'/pages/a.css'`
 * under win32 but `'/a.css'` here. Pinning POSIX makes the output platform
 * independent, which is what a browser bundle needs and what a
 * cross-machine-reproducible build wants anyway.
 *
 * ## The one behaviour that is not preserved: a relative `projectRoot`
 *
 * Node's `path.resolve` and `path.relative` fall back to `process.cwd()` for
 * relative inputs, so with a relative `projectRoot` the old output depended on
 * the directory the build ran from. `path-browserify` has no `cwd` to fall back
 * to and
 * treats a relative path as rooted instead, so those inputs now differ - and are
 * now deterministic. `parse` defaults `projectRoot` to `'/'`, and every in-repo
 * caller passes an absolute one, so nothing in the tree observes this. For every
 * absolute `projectRoot` the output is byte-identical; `test/generateHref.test.ts`
 * checks that against `node:path` itself over a generated matrix.
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
