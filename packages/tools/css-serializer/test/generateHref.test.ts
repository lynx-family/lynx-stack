// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Characterization tests for `generateHref` / `getFullPath`.
 *
 * `src/generateHref.ts` used to `import path from 'node:path'`, which made the
 * whole package unbundleable for browsers (`parse` -> `generateHref` -> `node:path`).
 * It now uses a small pure-JS POSIX path helper instead.
 *
 * These tests exist to prove that swap is behaviour preserving, and they do it
 * two ways, on purpose:
 *
 * 1. `differential vs node:path` uses the real `node:path` as an *oracle*: it
 *    re-implements the original algorithm on top of `node:path` and asserts the
 *    shipped implementation agrees, over a generated input matrix. Test code may
 *    import `node:path` freely - only the shipped `src/` may not.
 * 2. `href table` pins the concrete resulting strings. Those strings were
 *    generated from the pre-change `node:path` implementation, not hand-written,
 *    so the coverage survives even if the differential test above is ever deleted.
 *
 * ## The one place the oracle cannot be trusted: a relative `projectRoot`
 *
 * `path.resolve` and `path.relative` fall back to `process.cwd()` when handed a
 * relative path. With a relative `projectRoot` the *old* implementation therefore
 * produced different hrefs depending on the directory the build ran from, e.g.
 * `generateHref('proj', './index.css', '../../../../x.css')` returned
 * `'../../../x.css'` from a 1-deep cwd and `'../../../../x.css'` from a 4-deep one.
 * That is unspecifiable, so the differential matrix restricts itself to inputs
 * whose result is cwd independent (`projectRoot` absolute), and
 * `cwd-dependent inputs` below documents the deliberate divergence separately.
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

describe('generateHref', () => {
  describe('differential vs node:path', () => {
    const projectRoots = [
      '/',
      '//',
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
      // backslashes are ordinary characters under POSIX
      'C:\\x\\index.css',
      '\\a\\index.css',
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
      '@a\\b\\c.css',
      '/@pkg/a.css',
      // `..` traversal above `projectRoot`
      '../../../../x.css',
      '../../../../../../../../x.css',
      // empty-ish
      '',
      '.',
      '..',
      // Windows-ish separators, incl. drive letters and UNC
      'a\\b.css',
      '\\a.css',
      'C:\\x.css',
      '\\\\srv\\share\\x.css',
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

      expect(divergences).toEqual([]);
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
      {
        projectRoot: '//',
        filename: './index.css',
        origin: './a.css',
        href: '/a.css',
      },
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

      // backslashes are ordinary path characters under POSIX; only the final
      // `replaceAll` turns them into `/`, which is why `\a.css` doubles up
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'a\\b.css',
        href: '/a/b.css',
      },
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '\\a.css',
        href: '//a.css',
      },
      // drive letters are not absolute under POSIX, so `C:` becomes a segment
      {
        projectRoot: '/',
        filename: './index.css',
        origin: 'C:\\x.css',
        href: '/C:/x.css',
      },
      // ... and a UNC path is just a name with backslashes in it
      {
        projectRoot: '/',
        filename: './index.css',
        origin: '\\\\srv\\share\\x.css',
        href: '///srv/share/x.css',
      },
      {
        projectRoot: '/',
        filename: 'C:\\x\\index.css',
        origin: './a.css',
        href: '/a.css',
      },
      {
        projectRoot: '/',
        filename: '\\a\\index.css',
        origin: './a.css',
        href: '/a.css',
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
      // is pinning a `process.cwd()` artefact rather than a real behaviour. The
      // oracle agreeing here is what proves it: `path.resolve`/`path.relative`
      // only consult `cwd` for relative inputs.
      for (const { projectRoot, filename, origin, href } of cases) {
        expect(generateHrefOracle(projectRoot, filename, origin)).toBe(href);
      }
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
     * `path-browserify` is Node's POSIX implementation ported verbatim, which
     * means `resolve` still consults `process.cwd()` for a relative input. So a
     * relative `projectRoot` behaves exactly as it did before this change - i.e.
     * the output depends on the directory the build ran from.
     *
     * That is deliberately *not* fixed here. Fixing it would mean either
     * hand-rolling the resolution again (the code this change exists to delete)
     * or hardcoding a cwd, which is wrong for every caller. It is also
     * unobservable in practice: `parse` defaults `projectRoot` to `'/'` and every
     * in-repo caller passes an absolute one.
     *
     * Two consequences a caller should know about:
     *
     * - In a browser bundle there is no `process.cwd()`, so `path-browserify`
     *   falls back to treating the path as rooted. A relative `projectRoot`
     *   therefore resolves differently in a browser than in Node.
     * - Only an *absolute* `projectRoot` is guaranteed stable, and the
     *   differential suite above proves that case is byte-identical to
     *   `node:path`.
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
   * Native Windows paths are the one input class whose emitted href genuinely
   * changed, and the differential suite above cannot catch it: that oracle is
   * pinned to `path.posix` by design, so it agrees with the implementation on
   * every platform. These cases therefore assert the new values *literally*,
   * against a `path.win32` oracle that reproduces what the old implementation
   * emitted when the build ran on Windows.
   *
   * The divergence is accepted, not a regression to fix: `\` is a legal
   * character in a POSIX path, so a browser-safe helper cannot treat it as a
   * separator without inventing platform detection. It is called out in the
   * changeset, and it is why the change ships as a minor.
   */
  describe('native Windows paths (documented divergence)', () => {
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

    test.each([
      ['./a.css', '/pages/a.css', '/a.css'],
      ['../shared/b.css', '/shared/b.css', '../shared/b.css'],
    ])(
      'a backslash filename with %s changes from %s to %s',
      (origin, onWindowsBefore, now) => {
        // What the old implementation emitted on a Windows build host...
        expect(winOracle('C:\\proj', 'pages\\index.css', origin)).toBe(
          onWindowsBefore,
        );
        // ...versus what every platform emits now.
        expect(generateHref('C:\\proj', 'pages\\index.css', origin)).toBe(now);
      },
    );

    test('a drive letter is not a root under POSIX semantics', () => {
      // `C:\x.css` is one relative path segment, not an absolute path, so it is
      // resolved against `filename`'s directory rather than replacing it.
      expect(generateHref('/', './index.css', 'C:\\x.css')).toBe('/C:/x.css');
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
