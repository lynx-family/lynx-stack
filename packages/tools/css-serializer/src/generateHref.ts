/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

/**
 * `@import` href resolution, without `node:path`.
 *
 * This module used to `import path from 'node:path'`. Because `parse` imports
 * `generateHref`, that single import made the whole package impossible to bundle
 * for a browser, and the package exposes no subpath exports to import around it.
 * The helpers below are therefore a minimal, dependency-free reimplementation of
 * the four `path` functions this file used: `join`, `resolve`, `relative` and
 * `isAbsolute`.
 *
 * ## Why POSIX semantics
 *
 * `node:path`'s default export is `path.posix` on every non-Windows platform, so
 * POSIX is what the ReactLynx build has actually been doing. These helpers
 * reproduce `path.posix` exactly, which means, deliberately:
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
 * under win32 but `'/a.css'` under posix. Pinning POSIX makes the output
 * platform independent, which is what a browser bundle needs and what a
 * cross-machine-reproducible build wants anyway.
 *
 * ## The one behaviour that is not preserved: a relative `projectRoot`
 *
 * `path.resolve` and `path.relative` fall back to `process.cwd()` for relative
 * inputs, so with a relative `projectRoot` the old output depended on the
 * directory the build ran from. {@link posixResolve} has no `cwd` and treats a
 * relative path as rooted instead, so those inputs now differ - and are now
 * deterministic. `parse` defaults `projectRoot` to `'/'`, and every in-repo
 * caller passes an absolute one, so nothing in the tree observes this. For every
 * absolute `projectRoot` the output is byte-identical; `test/generateHref.test.ts`
 * checks that against `node:path` itself over a generated matrix.
 */

/**
 * Collapses `.` and `..` segments, mirroring the internal helper `node:path`
 * uses for both `normalize` and `resolve`.
 *
 * @param pathname - a `/`-separated path
 * @param allowAboveRoot - keep leading `..` that would escape the root, which is
 *   correct for relative paths and wrong for absolute ones
 */
function normalizeSegments(pathname: string, allowAboveRoot: boolean): string {
  const out: string[] = [];
  let aboveRoot = 0;

  for (const segment of pathname.split('/')) {
    // Empty segments come from repeated or trailing separators.
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (out.length > 0) {
        out.pop();
      } else if (allowAboveRoot) {
        aboveRoot += 1;
      }
      // An absolute path cannot escape its root, so `..` is dropped there.
      continue;
    }
    out.push(segment);
  }

  const body = out.join('/');
  if (aboveRoot === 0) {
    return body;
  }
  const prefix = '../'.repeat(aboveRoot);
  return body.length === 0 ? prefix.slice(0, -1) : prefix + body;
}

/** Equivalent to `path.posix.isAbsolute`. */
function posixIsAbsolute(pathname: string): boolean {
  return pathname.startsWith('/');
}

/** Equivalent to `path.posix.normalize`, including its trailing-slash handling. */
function posixNormalize(pathname: string): string {
  if (pathname.length === 0) {
    return '.';
  }
  const isAbsolute = posixIsAbsolute(pathname);
  const hasTrailingSlash = pathname.endsWith('/');
  const normalized = normalizeSegments(pathname, !isAbsolute);

  if (normalized.length === 0) {
    if (isAbsolute) {
      return '/';
    }
    return hasTrailingSlash ? './' : '.';
  }

  const withTrailingSlash = hasTrailingSlash ? `${normalized}/` : normalized;
  return isAbsolute ? `/${withTrailingSlash}` : withTrailingSlash;
}

/** Equivalent to `path.posix.join`. */
function posixJoin(...paths: string[]): string {
  let joined = '';
  for (const segment of paths) {
    // `join` ignores empty arguments entirely.
    if (segment.length === 0) {
      continue;
    }
    joined = joined.length === 0 ? segment : `${joined}/${segment}`;
  }
  return joined.length === 0 ? '.' : posixNormalize(joined);
}

/**
 * Equivalent to `path.posix.resolve`, except that it roots at `/` instead of
 * `process.cwd()` when the arguments never produce an absolute path. See the
 * module comment.
 */
function posixResolve(...paths: string[]): string {
  let resolved = '';
  let isAbsolute = false;

  // Right to left, stopping at the first absolute segment, as `resolve` does.
  for (let i = paths.length - 1; i >= 0 && !isAbsolute; i--) {
    const segment = paths[i] ?? '';
    if (segment.length === 0) {
      continue;
    }
    resolved = `${segment}/${resolved}`;
    isAbsolute = posixIsAbsolute(segment);
  }

  return `/${normalizeSegments(isAbsolute ? resolved : `/${resolved}`, false)}`;
}

/**
 * Equivalent to `path.posix.relative`, with {@link posixResolve}'s rooting rule
 * for relative inputs.
 */
function posixRelative(from: string, to: string): string {
  if (from === to) {
    return '';
  }
  const fromResolved = posixResolve(from);
  const toResolved = posixResolve(to);
  if (fromResolved === toResolved) {
    return '';
  }

  const fromSegments = fromResolved.split('/').filter((s) => s.length > 0);
  const toSegments = toResolved.split('/').filter((s) => s.length > 0);

  let common = 0;
  while (
    common < fromSegments.length
    && common < toSegments.length
    && fromSegments[common] === toSegments[common]
  ) {
    common += 1;
  }

  const up: string[] = new Array(fromSegments.length - common).fill('..');
  return [...up, ...toSegments.slice(common)].join('/');
}

export function getFullPath(
  projectRoot: string,
  filename: string,
  importStmt: string,
): string {
  let fullPath = '';
  if (importStmt.startsWith('/')) {
    fullPath = posixJoin(projectRoot, importStmt);
  } else if (importStmt.startsWith('@')) {
    fullPath = importStmt;
  } else {
    fullPath = posixResolve(filename, '..', importStmt);
  }

  return fullPath;
}

export function generateHref(
  projectRoot: string,
  filename: string,
  origin: string,
): string {
  filename = posixIsAbsolute(filename)
    ? filename
    : posixJoin(projectRoot, filename);
  const fullPath = getFullPath(projectRoot, filename, origin);

  let projectPath = posixRelative(projectRoot, fullPath);

  if (fullPath.startsWith('@')) {
    return normalizeSlashes(fullPath);
  } else if (!projectPath.startsWith('.')) {
    projectPath = posixJoin(POSIX_SEP, projectPath);
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
