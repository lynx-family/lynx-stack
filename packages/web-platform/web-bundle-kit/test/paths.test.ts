// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, test } from '@rstest/core';

type PathModule = typeof path.posix;

// scripts/paths.mjs is plain JavaScript run by the build; these are its types.
interface Paths {
  toPosix(relative: string, p?: PathModule): string;
  relativeSpecifier(fromDir: string, file: string, p?: PathModule): string;
  virtualPathOf(
    virtualDir: string,
    realDir: string,
    realFile: string,
    p?: PathModule,
  ): string;
  pathKey(file: string, p?: PathModule): string;
  isInside(file: string, dir: string, p?: PathModule): boolean;
}

let paths: Paths;
beforeAll(async () => {
  const file = createRequire(import.meta.url).resolve('../scripts/paths.mjs');
  paths = (await import(pathToFileURL(file).href)) as Paths;
});

const { win32, posix } = path;

describe('build script paths on Windows', () => {
  const kit = 'D:\\a\\lynx-stack\\packages\\web-platform\\web-bundle-kit';
  const store = 'D:\\a\\lynx-stack\\node_modules\\.pnpm';
  const rsbuild = `${store}\\@rsbuild+core@2.3.3\\node_modules\\@rsbuild\\core`;

  test('generated/registered.js imports with POSIX specifiers', () => {
    expect(
      paths.relativeSpecifier(
        `${kit}\\generated`,
        `${rsbuild}\\dist\\transformLoader.mjs`,
        win32,
      ),
    ).toBe(
      '../../../../node_modules/.pnpm/@rsbuild+core@2.3.3/node_modules/@rsbuild/core/dist/transformLoader.mjs',
    );
    expect(
      paths.relativeSpecifier(`${kit}\\generated`, `${kit}\\src\\a.js`, win32),
    ).toBe('../src/a.js');
    expect(
      paths.relativeSpecifier(`${kit}`, `${kit}\\generated\\a.js`, win32),
    ).toBe('./generated/a.js');
  });

  test('a file on another drive is not imported by an absolute path', () => {
    expect(() =>
      paths.relativeSpecifier(`${kit}\\generated`, 'E:\\cache\\a.js', win32)
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
