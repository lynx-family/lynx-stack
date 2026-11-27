// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { describe, expect, test } from '@rstest/core';

import * as paths from '../scripts/paths.ts';

const { win32, posix } = path;

describe('build script paths on Windows', () => {
  const kit = 'D:\\a\\lynx-stack\\packages\\web-platform\\web-bundle-kit';
  const store = 'D:\\a\\lynx-stack\\node_modules\\.pnpm';
  const rsbuild = `${store}\\@rsbuild+core@2.3.3\\node_modules\\@rsbuild\\core`;

  test('src/registered.ts imports with POSIX specifiers', () => {
    expect(
      paths.relativeSpecifier(
        `${kit}\\src`,
        `${rsbuild}\\dist\\transformLoader.mjs`,
        win32,
      ),
    ).toBe(
      '../../../../node_modules/.pnpm/@rsbuild+core@2.3.3/node_modules/@rsbuild/core/dist/transformLoader.mjs',
    );
    expect(
      paths.relativeSpecifier(`${kit}\\src`, `${kit}\\scripts\\a.js`, win32),
    ).toBe('../scripts/a.js');
    expect(
      paths.relativeSpecifier(`${kit}`, `${kit}\\src\\a.js`, win32),
    ).toBe('./src/a.js');
  });

  test('a file on another drive is not imported by an absolute path', () => {
    expect(() =>
      paths.relativeSpecifier(`${kit}\\src`, 'E:\\cache\\a.js', win32)
    ).toThrow(/cannot be imported relatively/);
  });

  test('virtual paths are POSIX', () => {
    expect(
      paths.virtualPathOf(
        '/node_modules/@rsbuild/core',
        rsbuild,
        `${rsbuild}\\compiled\\css-loader\\index.js`,
        win32,
      ),
    ).toBe('/node_modules/@rsbuild/core/compiled/css-loader/index.js');
    // Rspack and Node.js may disagree on the case of the drive letter.
    expect(
      paths.virtualPathOf(
        '/node_modules/@rsbuild/core',
        rsbuild,
        `d${rsbuild.slice(1)}\\dist\\index.js`,
        win32,
      ),
    ).toBe('/node_modules/@rsbuild/core/dist/index.js');
  });

  test('mirror keys use "/"', () => {
    expect(paths.toPosix('lib\\runtime\\css\\a.js', win32)).toBe(
      'lib/runtime/css/a.js',
    );
  });

  test('a resource path matches a list whatever the case of the drive', () => {
    const listed = `${store}\\a\\lib\\runtime\\css\\x.js`;
    expect(paths.pathKey(`d${listed.slice(1)}`, win32)).toBe(
      paths.pathKey(listed, win32),
    );
    expect(paths.pathKey(listed.replaceAll('\\', '/'), win32)).toBe(
      paths.pathKey(listed, win32),
    );
  });

  test('isInside compares whole segments, without case', () => {
    const browser = `${store}\\@rspack\\browser`;
    expect(paths.isInside(`${browser}\\dist\\index.js`, browser, win32)).toBe(
      true,
    );
    expect(paths.isInside(`d${browser.slice(1)}\\x.js`, browser, win32)).toBe(
      true,
    );
    expect(paths.isInside(browser, browser, win32)).toBe(true);
    expect(paths.isInside(`${browser}-x\\index.js`, browser, win32)).toBe(
      false,
    );
    expect(paths.isInside('E:\\x.js', browser, win32)).toBe(false);
  });
});

describe('build script paths on POSIX', () => {
  test('keys and containment stay case-sensitive', () => {
    expect(paths.pathKey('/A/b.js', posix)).toBe('/A/b.js');
    expect(paths.isInside('/a/b/c.js', '/a/b', posix)).toBe(true);
    expect(paths.isInside('/a/b/..c.js', '/a/b', posix)).toBe(true);
    expect(paths.isInside('/a/bc/d.js', '/a/b', posix)).toBe(false);
    expect(paths.relativeSpecifier('/a/g', '/a/n/x.js', posix)).toBe(
      '../n/x.js',
    );
    expect(paths.virtualPathOf('/node_modules/p', '/r/p', '/r/p/a/b.js', posix))
      .toBe('/node_modules/p/a/b.js');
  });
});
