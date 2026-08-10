// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Characterization tests for `generateHref` / `getFullPath`.
 *
 * `src/generateHref.ts` used to `import path from 'node:path'`, which made the
 * whole package unbundleable for browsers (`parse` -> `generateHref` -> `node:path`).
 * It now uses `pathe`, which works in both a browser bundle and Node.
 *
 * These tests exist to characterize that swap, and they do it two ways on purpose:
 *
 * 1. `differential vs node:path` uses the real `node:path` as an *oracle*: it
 *    re-implements the original algorithm on top of `node:path` and asserts the
 *    shipped implementation agrees, over a generated input matrix. Test code may
 *    import `node:path` freely - only the shipped `src/` may not.
 * 2. `href table` pins the concrete resulting strings, so the coverage survives
 *    even if the differential test above is ever deleted.
 *
 * ## `pathe` is not `path.posix`, and where that shows
 *
 * `pathe` normalizes Windows paths: it treats `\` as a separator, upper-cases a
 * drive letter, and preserves a leading `//`. `path.posix` does none of that. So
 * the oracle only applies to inputs that contain no backslash - which is every
 * path this tree actually produces, since `parse` defaults `projectRoot` to `'/'`
 * and `filename` to `'./index.css'`. Backslash inputs are pinned by value
 * instead, in `native Windows paths (documented divergence)`.
 *
 * Two narrower divergences are pinned individually rather than excluded, so that
 * neither a new divergence nor an upstream fix can pass unnoticed:
 *
 * - `getFullPath` with a `//`-prefixed `@import` and a `projectRoot` that
 *   normalizes to `/` (`pathe` keeps the `//`, `path.posix` collapses it). This
 *   one never reaches an href - see `getFullPath ... divergences are exactly`.
 * - `projectRoot === '//'`, which makes `pathe` leak `process.cwd()` into the
 *   output. See `projectRoot '//' is not supported`.
 *
 * ## The one place the oracle cannot be trusted: a relative `projectRoot`
 *
 * `path.resolve` and `path.relative` fall back to `process.cwd()` when handed a
 * relative path. With a relative `projectRoot` the *old* implementation therefore
 * produced different hrefs depending on the directory the build ran from, e.g.
 * `generateHref('proj', './index.css', '../../../../x.css')` returned
 * `'../../../x.css'` from a 1-deep cwd and `'../../../../x.css'` from a 4-deep one.
 * That is unspecifiable, so the differential matrix restricts itself to inputs
 * whose result is cwd independent (`projectRoot` absolute).
 *
 * In practice `projectRoot` is absolute: `parse` defaults it to `'/'`.
 */

import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { generateHref, getFullPath } from '../src/generateHref.js';
import { parse } from '../src/index.js';

/**
 * The original, pre-change implementation, transcribed verbatim on top of
 * `node:path`. This is the oracle - it is intentionally *not* refactored, so it
 * keeps matching the code that shipped in 0.1.7.
 *
 * The oracle pins `path.posix` where the original used the platform-dependent
 * default export. That default *is* `path.posix` on Linux and macOS, so there
 * this stays a verbatim transcription. On Windows the default is `path.win32`,
 * which treats `\` as a separator and `C:\` as absolute; an unpinned oracle
 * would therefore demand win32 semantics from an implementation that is now
 * deliberately POSIX-only, and disagree on inputs such as `\a.css`, `C:\x.css`
 * or `\\srv\share\x.css`. Pinning keeps the oracle a fixed description of the
 * behaviour that shipped instead of one that changes with the runner's OS.
 *
 * `path.win32.sep` below is deliberately left as-is: the original names that
 * one explicitly, so it is win32 on every platform.
 */
const oraclePath = path.posix;

function getFullPathOracle(
  projectRoot: string,
  filename: string,
  importStmt: string,
): string {
  let fullPath = '';
  if (importStmt.startsWith('/')) {
    fullPath = oraclePath.join(projectRoot, importStmt);
  } else if (importStmt.startsWith('@')) {
    fullPath = importStmt;
  } else {
    fullPath = oraclePath.resolve(filename, '..', importStmt);
  }

  return fullPath;
}

function generateHrefOracle(
  projectRoot: string,
  filename: string,
  origin: string,
): string {
  filename = oraclePath.isAbsolute(filename)
    ? filename
    : oraclePath.join(projectRoot, filename);
  const fullPath = getFullPathOracle(projectRoot, filename, origin);

  let projectPath = oraclePath.relative(projectRoot, fullPath);

  if (fullPath.startsWith('@')) {
    return fullPath.replaceAll(path.win32.sep, '/');
  } else if (!projectPath.startsWith('.')) {
    projectPath = oraclePath.join(oraclePath.sep, projectPath);
  }

  return projectPath.replaceAll(path.win32.sep, '/');
}

/**
 * True for the one input shape where `pathe` and `path.posix` disagree without a
 * backslash being involved: `pathe.normalize` reads a leading `//` as a UNC
 * prefix and keeps it, `path.posix.normalize` collapses it.
 *
 * It only bites when `projectRoot` normalizes to `/`, because otherwise `join`
 * puts a real segment in front of the doubled slash.
 */
function keepsLeadingDoubleSlash(projectRoot: string, origin: string): boolean {
  return origin.startsWith('//') && oraclePath.normalize(projectRoot) === '/';
}

describe('generateHref', () => {
  /**
   * The matrix below deliberately contains **no backslashes**. `pathe` treats
   * `\` as a separator, `path.posix` treats it as an ordinary character, so any
   * such input diverges by construction and comparing them would prove nothing.
   * Those inputs are pinned by value in `native Windows paths` further down.
   *
   * `projectRoot` is likewise never `'//'`, which `pathe` mishandles badly enough
   * to leak `process.cwd()`; that is pinned in `projectRoot '//' is not supported`.
   *
   * For everything else - which is every path this tree actually produces, since
   * `parse` defaults `projectRoot` to `'/'` - `pathe` must agree with
   * `path.posix` exactly.
   */
  describe('differential vs node:path', () => {
    const projectRoots = [
      '/',
      '/a',
      '/a/',
      '/a//b',
      '/a/b/c',
      '/user/test/project1',
    ];
    const filenames = [
      // `parse`'s default
      './index.css',
      'index.css',
      'pages/view/index.css',
      // absolute `filename` skips the `path.join(projectRoot, filename)` branch
      '/abs/index.css',
      '/a/b/c/d/index.css',
      // empty-ish
      '',
      '.',
      '..',
      // repeated + trailing separators
      'a//b/index.css',
      'dir/',
    ];
    const origins = [
      // plain relative
      './test.css',
      '../test2.css',
      'printstyle.css',
      'a/./b/../c.css',
      'sub/',
      // leading `/` -> `path.join(projectRoot, importStmt)` branch
      '/test.css',
      '//test.css',
      '///test.css',
      // leading `@` -> passthrough branch
      '@ies/ug-lynx-components/lib/styles.css',
      '@',
      '/@pkg/a.css',
      // `..` traversal above `projectRoot`
      '../../../../x.css',
      '../../../../../../../../x.css',
      // empty-ish
      '',
      '.',
      '..',
    ];

    // Deliberately not `test.each`: this is ~2k cases and per-case test
    // registration makes the reporter unreadable. Failures still name the input.
    test('matches the node:path oracle across the input matrix', () => {
      const divergences: string[] = [];
      let compared = 0;

      for (const projectRoot of projectRoots) {
        for (const filename of filenames) {
          for (const origin of origins) {
            compared += 1;
            const actual = generateHref(projectRoot, filename, origin);
            const expected = generateHrefOracle(projectRoot, filename, origin);
            if (actual !== expected) {
              divergences.push(
                `generateHref(${JSON.stringify(projectRoot)}, ${
                  JSON.stringify(filename)
                }, ${JSON.stringify(origin)}) => ${JSON.stringify(actual)}, `
                  + `node:path oracle => ${JSON.stringify(expected)}`,
              );
            }
          }
        }
      }

      // Guard against the matrix silently collapsing to nothing.
      expect(compared).toBe(
        projectRoots.length * filenames.length * origins.length,
      );
      expect(divergences).toEqual([]);
    });

    test('getFullPath matches the node:path oracle across the input matrix', () => {
      const divergences: string[] = [];
      let compared = 0;
      let knownDivergent = 0;

      for (const projectRoot of projectRoots) {
        for (const filename of filenames) {
          for (const origin of origins) {
            // `getFullPath` is exported but unused in-repo, and it forwards a
            // caller-supplied `filename` straight to `resolve`, so only feed it
            // absolute filenames - a relative one is cwd dependent.
            const absFilename = oraclePath.isAbsolute(filename)
              ? filename
              : oraclePath.join(projectRoot, filename);
            const actual = getFullPath(projectRoot, absFilename, origin);
            const expected = getFullPathOracle(
              projectRoot,
              absFilename,
              origin,
            );

            if (keepsLeadingDoubleSlash(projectRoot, origin)) {
              // Pinned in `getFullPath // divergences` below, not compared here.
              knownDivergent += 1;
              continue;
            }

            compared += 1;
            if (actual !== expected) {
              divergences.push(
                `getFullPath(${JSON.stringify(projectRoot)}, ${
                  JSON.stringify(absFilename)
                }, ${JSON.stringify(origin)}) => ${JSON.stringify(actual)}, `
                  + `node:path oracle => ${JSON.stringify(expected)}`,
              );
            }
          }
        }
      }

      // The excluded set must stay small and accounted for, so that widening it
      // can never be the thing that makes this test pass.
      expect(knownDivergent).toBe(20);
      expect(compared).toBe(
        projectRoots.length * filenames.length * origins.length - 20,
      );
      expect(divergences).toEqual([]);
    });

    /**
     * The only `getFullPath` divergence in the matrix above, pinned by value.
     *
     * `pathe.normalize` preserves a leading `//` (it reads it as a UNC prefix);
     * `path.posix.normalize` collapses it to `/`. So when `projectRoot`
     * normalizes to `/`, a `//`-prefixed `@import` takes the
     * `join(projectRoot, importStmt)` branch and keeps its doubled slash.
     *
     * This is pinned rather than excluded for two reasons: excluding it would let
     * a future, unrelated divergence hide in the same hole, and pinning it means
     * an upstream `pathe` fix turns this red instead of silently changing output.
     *
     * It does not reach an href: `generateHref` runs the result through
     * `relative()`, which collapses the `//` in both implementations. The
     * `no href starts with //` test below is what holds that line.
     */
    test('getFullPath // divergences are exactly the leading-double-slash ones', () => {
      // `origin` starts with `/`, so `filename` is not consulted on this branch.
      expect(getFullPath('/', '/index.css', '//test.css')).toBe('//test.css');
      expect(getFullPathOracle('/', '/index.css', '//test.css')).toBe(
        '/test.css',
      );

      // Three or more leading slashes collapse to exactly two, not to one.
      expect(getFullPath('/', '/index.css', '///test.css')).toBe('//test.css');
      expect(getFullPathOracle('/', '/index.css', '///test.css')).toBe(
        '/test.css',
      );

      // A `projectRoot` with any segment in it is unaffected: `join` no longer
      // leaves the `//` at position 0.
      for (const projectRoot of ['/a', '/a/', '/a//b', '/a/b/c']) {
        expect(getFullPath(projectRoot, `${projectRoot}/index.css`, '//t.css'))
          .toBe(
            getFullPathOracle(
              projectRoot,
              `${projectRoot}/index.css`,
              '//t.css',
            ),
          );
      }
    });

    test('no href starts with // even though getFullPath can', () => {
      // The divergence above is contained by `relative()`. Prove it over the
      // same matrix rather than asserting it in prose.
      let checked = 0;
      for (const projectRoot of projectRoots) {
        for (const filename of filenames) {
          for (const origin of origins) {
            checked += 1;
            expect(generateHref(projectRoot, filename, origin)).not.toContain(
              '//',
            );
          }
        }
      }
      expect(checked).toBe(
        projectRoots.length * filenames.length * origins.length,
      );
    });
  });

  describe('href table', () => {
    // Generated from the pre-change `node:path` implementation. Every row is
    // cwd independent - verified by running the generator from several
    // different working directories and diffing the output.
    const cases: {
      projectRoot: string;
      filename: string;
      origin: string;
      href: string;
    }[] = [
      // `parse` defaults, and the hrefs the `import` snapshot already pins
      {
        projectRoot: '/',
        filename: './index.css',
        origin: './test.css',
        href: '/test.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '../test2.css',
        href: '/test2.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'printstyle.css',
        href: '/printstyle.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '@ies/ug-lynx-components/lib/styles.css',
        href: '@ies/ug-lynx-components/lib/styles.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '/test.css',
        href: '/test.css',
      },

      // non-default `filename` / `projectRoot`, as the `important` test uses
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: './a.css',
        href: '/pages/view/a.css',
      },
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: '../a.css',
        href: '/pages/a.css',
      },
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: '/a.css',
        href: '/a.css',
      },
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: '@scope/pkg/a.css',
        href: '@scope/pkg/a.css',
      },

      // `..` traversal above `projectRoot` keeps a relative, `.`-prefixed href,
      // which is what skips the `join(sep, projectPath)` branch
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: '../../../a.css',
        href: '../a.css',
      },
      {
        projectRoot: '/user/test/project1',
        filename: 'pages/view/index.css',
        origin: '../../../../../../a.css',
        href: '../../../a.css',
      },
      {
        projectRoot: '/a/b/c',
        filename: 'index.css',
        origin: '../../../../x.css',
        href: '../../../x.css',
      },
      {
        projectRoot: '/a/b/c',
        filename: 'd/index.css',
        origin: '../../../../../x.css',
        href: '../../../x.css',
      },

      // an absolute `filename` bypasses `join(projectRoot, filename)`
      {
        projectRoot: '/user/test/project1',
        filename: '/other/root/index.css',
        origin: './a.css',
        href: '../../../other/root/a.css',
      },
      {
        projectRoot: '/root',
        filename: '/root/deep/index.css',
        origin: '../shallow.css',
        href: '/shallow.css',
      },

      // `.` segments, repeated and trailing separators
      {
        projectRoot: '/',
        filename: './index.css',
        origin: './a/./b/../c.css',
        href: '/a/c.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'a//b.css',
        href: '/a/b.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'sub/',
        href: '/sub',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '//x.css',
        href: '/x.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '///x.css',
        href: '/x.css',
      },
      {
        projectRoot: '/',
        filename: 'a//b/index.css',
        origin: './c.css',
        href: '/a/b/c.css',
      },
      {
        projectRoot: '/a/',
        filename: 'b/index.css',
        origin: './c.css',
        href: '/b/c.css',
      },
      // `projectRoot: '//'` deliberately has no row here: `pathe` leaks
      // `process.cwd()` into the result, so there is no cwd-independent value to
      // pin. See `projectRoot '//' is not supported` below.
      {
        projectRoot: '/a//b',
        filename: 'index.css',
        origin: './c.css',
        href: '/c.css',
      },

      // empty-ish inputs
      { projectRoot: '/', filename: './index.css', origin: '', href: '/' },
      { projectRoot: '/', filename: './index.css', origin: '.', href: '/' },
      { projectRoot: '/', filename: './index.css', origin: '..', href: '/' },
      { projectRoot: '/', filename: '', origin: './a.css', href: '/a.css' },
      { projectRoot: '/', filename: '.', origin: './a.css', href: '/a.css' },
      { projectRoot: '/', filename: '..', origin: './a.css', href: '/a.css' },
      {
        projectRoot: '/a/b',
        filename: '',
        origin: './a.css',
        href: '../a.css',
      },
      {
        projectRoot: '/a/b',
        filename: '..',
        origin: 'x.css',
        href: '../../x.css',
      },
      { projectRoot: '/', filename: './index.css', origin: '/', href: '/' },
      { projectRoot: '/a', filename: '/a', origin: '', href: '..' },

      // `@` passthrough, including the win32-separator normalization on it
      { projectRoot: '/', filename: './index.css', origin: '@', href: '@' },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '@a\\b\\c.css',
        href: '@a/b/c.css',
      },
      // a leading `/` wins over `@`, so this is *not* passthrough
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '/@pkg/a.css',
        href: '/@pkg/a.css',
      },

      // `pathe` treats `\` as a separator, so these are *path* inputs, not
      // filenames that happen to contain a backslash. The resulting hrefs match
      // neither `path.posix` (which treats `\` as an ordinary character) nor
      // `path.win32` in every case; the three-way comparison lives in
      // `native Windows paths (documented divergence)` below. Values measured,
      // not derived.
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'a\\b.css',
        href: '/a/b.css',
      },
      // `'\a.css'` is an absolute path to `pathe`, so it replaces `filename`'s
      // directory. `path.posix` produced `'//a.css'` here.
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '\\a.css',
        href: '/a.css',
      },
      // A drive letter *is* a root to `pathe`, so `C:/x.css` escapes
      // `projectRoot` and stays relative. `path.posix` produced `'/C:/x.css'`.
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'C:\\x.css',
        href: '../C:/x.css',
      },
      // A UNC path collapses to a single leading slash once `relative()` has run.
      // `path.posix` produced `'///srv/share/x.css'`.
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '\\\\srv\\share\\x.css',
        href: '/srv/share/x.css',
      },
      // A backslash `filename` is a real directory chain to `pathe`, so `./a.css`
      // resolves next to it instead of next to `projectRoot`. `path.posix`
      // produced `'/a.css'` for both of these.
      {
        projectRoot: '/',
        filename: 'C:\\x\\index.css',
        origin: './a.css',
        href: '../C:/x/a.css',
      },
      {
        projectRoot: '/',
        filename: '\\a\\index.css',
        origin: './a.css',
        href: '/a/a.css',
      },
      {
        projectRoot: 'C:\\proj',
        filename: 'index.css',
        origin: './a.css',
        href: '/a.css',
      },
    ];

    test.each(cases)(
      'generateHref($projectRoot, $filename, $origin) === $href',
      ({ projectRoot, filename, origin, href }) => {
        expect(generateHref(projectRoot, filename, origin)).toBe(href);
      },
    );

    test('the table is cwd independent', () => {
      // Every row above must hold no matter where the process runs, otherwise it
      // is pinning a `process.cwd()` artefact rather than a real behaviour.
      //
      // This re-runs the real implementation from several directories rather than
      // consulting the `path.posix` oracle: the backslash rows are pinned
      // *because* they diverge from that oracle, so the oracle can no longer
      // stand in for "cwd independent".
      const original = process.cwd();
      try {
        for (const dir of ['/', '/tmp', '/usr/share']) {
          process.chdir(dir);
          for (const { projectRoot, filename, origin, href } of cases) {
            expect(
              generateHref(projectRoot, filename, origin),
              `cwd=${dir} generateHref(${projectRoot}, ${filename}, ${origin})`,
            ).toBe(href);
          }
        }
      } finally {
        process.chdir(original);
      }
    });

    test('the backslash-free rows still match the node:path oracle', () => {
      // The rows that predate this change must keep agreeing with `path.posix`,
      // which is what `node:path` resolved to on every non-Windows platform.
      let checked = 0;
      for (const { projectRoot, filename, origin, href } of cases) {
        if (
          projectRoot.includes('\\') || filename.includes('\\')
          || origin.includes('\\')
        ) continue;
        checked += 1;
        expect(generateHrefOracle(projectRoot, filename, origin)).toBe(href);
      }
      // Guard against the filter swallowing the whole table.
      expect(checked).toBeGreaterThan(25);
    });
  });

  describe('win32 separator normalization', () => {
    // The `replaceAll(path.win32.sep, '/')` on the way out is load bearing:
    // hrefs must always use `/`, whatever the input used.
    test('rewrites backslashes in the @-passthrough branch', () => {
      expect(generateHref('/', './index.css', '@pkg\\lib\\a.css')).toBe(
        '@pkg/lib/a.css',
      );
      expect(generateHref('/', './index.css', '@pkg\\lib\\a.css')).not
        .toContain(
          '\\',
        );
    });

    test('rewrites backslashes in the resolved-path branch', () => {
      expect(generateHref('/', './index.css', 'lib\\a.css')).toBe('/lib/a.css');
      expect(generateHref('/', './index.css', 'lib\\a.css')).not.toContain(
        '\\',
      );
    });

    test('no href in the matrix leaks a backslash', () => {
      for (
        const origin of [
          'a\\b.css',
          '\\a.css',
          'C:\\x.css',
          '\\\\srv\\share\\x.css',
          '@a\\b.css',
        ]
      ) {
        expect(generateHref('/', './index.css', origin)).not.toContain('\\');
      }
    });
  });

  describe('the join(sep, projectPath) branch', () => {
    // Line 40 of the original: when the resolved path is *inside* projectRoot,
    // `path.relative` returns a bare relative path and it gets re-rooted.
    test('re-roots paths inside projectRoot with a leading slash', () => {
      expect(
        generateHref('/user/test/project1', 'pages/view/index.css', './a.css'),
      )
        .toBe('/pages/view/a.css');
      expect(generateHref('/a/b', 'c/index.css', 'd.css')).toBe('/c/d.css');
    });

    test('leaves paths outside projectRoot relative', () => {
      // `..`-prefixed, so it must *not* be re-rooted
      expect(generateHref('/a/b', 'index.css', '../../../x.css')).toBe(
        '../../x.css',
      );
      expect(
        generateHref('/a/b', 'index.css', '../../../x.css').startsWith('/'),
      ).toBe(false);
    });
  });

  describe('a relative projectRoot stays cwd-dependent', () => {
    /**
     * `pathe` has its own `cwd()` helper that returns `process.cwd()` when a
     * `process` global exists, so `resolve` still consults the working directory
     * for a relative input. A relative `projectRoot` therefore behaves as it did
     * before this change: the output depends on where the build ran from.
     *
     * That is deliberately *not* fixed here. Fixing it would mean either
     * hand-rolling the resolution again (the code this change exists to delete)
     * or hardcoding a cwd, which is wrong for every caller. It is also
     * unobservable in practice: `parse` defaults `projectRoot` to `'/'` and every
     * in-repo caller passes an absolute one.
     *
     * Two consequences a caller should know about:
     *
     * - In a browser bundle there is no `process.cwd()`, so `pathe`'s `cwd()`
     *   returns `'/'`. A relative `projectRoot` therefore resolves differently in
     *   a browser than in Node.
     * - Only an *absolute* `projectRoot` is guaranteed stable - and `'//'` is the
     *   one absolute value that is not, see below.
     */
    test('an absolute projectRoot is cwd-independent', () => {
      const cwd = process.cwd();
      try {
        process.chdir('/');
        const atRoot = generateHref('/proj', 'index.css', '../../x.css');
        process.chdir('/tmp');
        const atTmp = generateHref('/proj', 'index.css', '../../x.css');
        expect(atRoot).toBe(atTmp);
        expect(atRoot).toBe('../x.css');
      } finally {
        process.chdir(cwd);
      }
    });

    test('a relative projectRoot resolves against cwd, as node:path does', () => {
      const cwd = process.cwd();
      try {
        process.chdir('/');
        expect(generateHref('proj', 'index.css', './a.css')).toBe('/a.css');
        expect(generateHref('proj', 'index.css', '../../x.css')).toBe(
          '../x.css',
        );
      } finally {
        process.chdir(cwd);
      }
    });
  });

  /**
   * `projectRoot: '//'` is not supported, and this is a real defect rather than a
   * documented trade-off. It is pinned instead of deleted so that it stays
   * visible and so an upstream fix turns this red rather than silently changing
   * output.
   *
   * The mechanism, read off `pathe`'s source rather than inferred:
   *
   * - `normalize()` emits `//./<rest>` when it sees a UNC-shaped path that its
   *   own `isAbsolute` considers relative.
   * - `isAbsolute`'s UNC branch is `/^[/\\]{2}(?!\.)/`, so it rejects the very
   *   string `normalize()` just produced.
   * - `resolve()` therefore finds no absolute argument and falls back to
   *   `cwd()` - which is `process.cwd()` in Node.
   *
   * So `join('//', './index.css')` gives `'//./index.css'`, `isAbsolute` says
   * `false`, and the working directory ends up in the href. `path.posix` gives
   * `'/index.css'` and is absolute, which is why this is new.
   *
   * It needs `projectRoot` to normalize to `//` *and* a `filename` starting with
   * `.` - which is exactly `parse`'s `'./index.css'` default. `'//'` is not a root
   * anything in this tree passes, but it is not a shape a caller would expect to
   * be rejected either.
   */
  describe('projectRoot \'//\' is not supported', () => {
    test('leaks process.cwd() into the href', () => {
      const cwd = process.cwd();
      try {
        // Pinned per-directory rather than asserted to be "unstable": an
        // inequality assertion would also pass if the two values differed for
        // some unrelated reason. These say *what* leaks.
        process.chdir('/tmp');
        expect(generateHref('//', './index.css', './a.css')).toBe('/tmp/a.css');
        process.chdir('/usr/share');
        expect(generateHref('//', './index.css', './a.css')).toBe(
          '/usr/share/a.css',
        );

        // The control: a single-slash root is cwd independent, so the leak is
        // specific to `'//'` and not an artefact of the chdir harness.
        process.chdir('/tmp');
        const atTmp = generateHref('/', './index.css', './a.css');
        process.chdir('/usr/share');
        expect(generateHref('/', './index.css', './a.css')).toBe(atTmp);
        expect(atTmp).toBe('/a.css');
      } finally {
        process.chdir(cwd);
      }
    });

    test('the leak needs a dot-prefixed filename', () => {
      const cwd = process.cwd();
      try {
        // `join('//', 'index.css')` is `'//index.css'`, which `isAbsolute`
        // accepts, so `resolve` never reaches its `cwd()` fallback.
        process.chdir('/tmp');
        const atTmp = generateHref('//', 'index.css', './a.css');
        process.chdir('/usr/share');
        expect(generateHref('//', 'index.css', './a.css')).toBe(atTmp);
      } finally {
        process.chdir(cwd);
      }
    });
  });

  /**
   * Native Windows paths are the input class the `path.posix` oracle cannot speak
   * about, because `pathe` deliberately understands them and `path.posix` does
   * not. Everything here is therefore pinned against **both** oracles at once, so
   * the three-way picture is in the test output rather than in prose.
   *
   * The headline: for the common shapes - a drive-letter or backslash
   * `projectRoot` with a relative `filename` - `pathe` agrees with `path.win32`,
   * which means these hrefs are *unchanged* from what a Windows build host used to
   * emit. That was not true of a pure-POSIX helper.
   *
   * It is not a blanket "Windows is fixed" claim, and the tests below say where it
   * stops: a measured 120 of 150 cwd-free cases in this shape agree with
   * `path.win32`, and the remaining 30 are pinned by class -
   * cross-root/cross-drive combinations, a `\`-rooted absolute `filename` under a
   * drive-letter root, and a drive-letter `@import`.
   */
  describe('native Windows paths', () => {
    /** What the old implementation emitted when the build ran on Windows. */
    const winOracle = (
      projectRoot: string,
      filename: string,
      origin: string,
    ) => {
      const P = path.win32;
      const abs = P.isAbsolute(filename)
        ? filename
        : P.join(projectRoot, filename);
      const full = origin.startsWith('/')
        ? P.join(projectRoot, origin)
        : origin.startsWith('@')
        ? origin
        : P.resolve(abs, '..', origin);
      let rel = P.relative(projectRoot, full);
      if (full.startsWith('@')) return full.replaceAll(path.win32.sep, '/');
      if (!rel.startsWith('.')) rel = P.join(P.sep, rel);
      return rel.replaceAll(path.win32.sep, '/');
    };

    /**
     * The common case: a relative `filename` under a Windows-shaped
     * `projectRoot`. `pathe` matches the old Windows output, and both differ from
     * `path.posix` - which is what a POSIX-only helper would have produced on
     * every platform.
     */
    test.each([
      ['C:\\proj', 'pages\\index.css', './a.css', '/pages/a.css', '/a.css'],
      [
        'C:\\proj',
        'pages\\index.css',
        '../shared/b.css',
        '/shared/b.css',
        '../shared/b.css',
      ],
      [
        'C:\\proj',
        'pages\\index.css',
        'a\\b.css',
        '/pages/a/b.css',
        '/a/b.css',
      ],
      ['\\proj', 'pages\\index.css', './a.css', '/pages/a.css', '/a.css'],
      [
        '\\\\srv\\share',
        'pages\\index.css',
        './a.css',
        '/pages/a.css',
        '/a.css',
      ],
    ])(
      'generateHref(%j, %j, %j) === %j, matching the old Windows output',
      (projectRoot, filename, origin, expected, posixWouldGive) => {
        expect(generateHref(projectRoot, filename, origin)).toBe(expected);
        // Same as a Windows build host used to emit: no change for these.
        expect(winOracle(projectRoot, filename, origin)).toBe(expected);
        // And genuinely different from what POSIX semantics would give, so the
        // assertion above is not vacuous.
        expect(generateHrefOracle(projectRoot, filename, origin)).toBe(
          posixWouldGive,
        );
        expect(expected).not.toBe(posixWouldGive);
      },
    );

    test('a leading `/` @import is unchanged under every semantics', () => {
      // This branch is `join(projectRoot, origin)`, which all three agree on.
      for (const oracle of [winOracle, generateHrefOracle]) {
        expect(oracle('C:\\proj', 'pages\\index.css', '/a.css')).toBe('/a.css');
      }
      expect(generateHref('C:\\proj', 'pages\\index.css', '/a.css')).toBe(
        '/a.css',
      );
    });

    test('an @import passthrough is unchanged under every semantics', () => {
      for (const oracle of [winOracle, generateHrefOracle]) {
        expect(oracle('C:\\proj', 'pages\\index.css', '@p/a.css')).toBe(
          '@p/a.css',
        );
      }
      expect(generateHref('C:\\proj', 'pages\\index.css', '@p/a.css')).toBe(
        '@p/a.css',
      );
    });

    /**
     * Where `pathe` and `path.win32` part company. These are pinned, not
     * defended - they are the residual Windows risk in this change.
     */
    describe('divergence from the old Windows behaviour', () => {
      test('a drive-letter @import escapes projectRoot', () => {
        // `pathe` reads `C:\` as a root, so `resolve` discards `filename`'s
        // directory and the result lands outside `projectRoot`.
        expect(generateHref('/', './index.css', 'C:\\x.css')).toBe(
          '../C:/x.css',
        );
        // Both oracles rooted it instead.
        expect(winOracle('/', './index.css', 'C:\\x.css')).toBe('/C:/x.css');
        expect(generateHrefOracle('/', './index.css', 'C:\\x.css')).toBe(
          '/C:/x.css',
        );
      });

      test('a UNC @import loses its doubled leading slash', () => {
        expect(generateHref('/', './index.css', '\\\\srv\\share\\x.css')).toBe(
          '/srv/share/x.css',
        );
        // win32 agrees here; `path.posix` kept every slash it was given.
        expect(winOracle('/', './index.css', '\\\\srv\\share\\x.css')).toBe(
          '/srv/share/x.css',
        );
        expect(
          generateHrefOracle('/', './index.css', '\\\\srv\\share\\x.css'),
        ).toBe('///srv/share/x.css');
      });

      test('a leading-backslash @import is absolute, as it is on win32', () => {
        expect(generateHref('/', './index.css', '\\a.css')).toBe('/a.css');
        expect(winOracle('/', './index.css', '\\a.css')).toBe('/a.css');
        // `path.posix` treated the `\` as an ordinary character, so it doubled up.
        expect(generateHrefOracle('/', './index.css', '\\a.css')).toBe(
          '//a.css',
        );
      });

      test('a `\\`-rooted filename under a drive root emits a doubled slash', () => {
        // `relative()` keeps the UNC-shaped `//abs` it is handed, so the href has
        // a `//` in the middle of it. This is a `pathe` artefact, not a shape
        // either oracle produces.
        expect(generateHref('C:\\proj', '\\abs\\index.css', './a.css')).toBe(
          '../..//abs/a.css',
        );
        expect(winOracle('C:\\proj', '\\abs\\index.css', './a.css')).toBe(
          '/abs/a.css',
        );
      });

      test('a cross-drive filename stays relative instead of being rooted', () => {
        expect(
          generateHref('D:\\a\\b', 'C:\\proj\\pages\\index.css', './a.css'),
        ).toBe('C:/proj/pages/a.css');
        expect(winOracle('D:\\a\\b', 'C:\\proj\\pages\\index.css', './a.css'))
          .toBe('/C:/proj/pages/a.css');
      });
    });

    test('POSIX callers are unaffected on every platform', () => {
      // The shape every in-repo caller uses - `parse`'s defaults. Note `..` at
      // the root is clamped, so this stays inside the project.
      expect(generateHref('/', './index.css', './a.css')).toBe('/a.css');
      expect(generateHref('/', './index.css', '../shared/b.css')).toBe(
        '/shared/b.css',
      );
    });
  });

  describe('integration through parse', () => {
    // `generateHref` has exactly one in-repo caller: `parse`, for
    // `ImportRule.href`. Pin that wiring so a signature-compatible but
    // wrongly-wired refactor is still caught.
    test('populates ImportRule.href using parse defaults', () => {
      const { root } = parse(
        [
          `@import './test.css';`,
          `@import '../test2.css';`,
          `@import "printstyle.css";`,
          `@import "@ies/ug-lynx-components/lib/styles.css";`,
        ].join('\n'),
      );

      expect(root.filter((node) => node.type === 'ImportRule')).toEqual([
        { type: 'ImportRule', origin: './test.css', href: '/test.css' },
        { type: 'ImportRule', origin: '../test2.css', href: '/test2.css' },
        {
          type: 'ImportRule',
          origin: 'printstyle.css',
          href: '/printstyle.css',
        },
        {
          type: 'ImportRule',
          origin: '@ies/ug-lynx-components/lib/styles.css',
          href: '@ies/ug-lynx-components/lib/styles.css',
        },
      ]);
    });

    test('honours a non-default filename and projectRoot', () => {
      const { root } = parse(`@import './a.css';\n@import '../../../b.css';`, {
        filename: 'pages/view/index.css',
        projectRoot: '/user/test/project1',
      });

      expect(root.filter((node) => node.type === 'ImportRule')).toEqual([
        { type: 'ImportRule', origin: './a.css', href: '/pages/view/a.css' },
        { type: 'ImportRule', origin: '../../../b.css', href: '../b.css' },
      ]);
    });
  });
});
