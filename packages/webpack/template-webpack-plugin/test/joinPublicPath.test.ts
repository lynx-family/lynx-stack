// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { joinPublicPath } from '../src/LynxTemplatePlugin.js';

describe('joinPublicPath', () => {
  describe('absolute-URL publicPath', () => {
    test('joins via new URL and preserves origin + path', () => {
      expect(
        joinPublicPath(
          'https://example.com/',
          '.rspeedy/main/debug-metadata.json',
        ),
      ).toBe('https://example.com/.rspeedy/main/debug-metadata.json');
    });

    test('handles publicPath with a path prefix', () => {
      expect(
        joinPublicPath(
          'https://cdn.example.com/static/',
          '.rspeedy/main/debug-metadata.json',
        ),
      ).toBe(
        'https://cdn.example.com/static/.rspeedy/main/debug-metadata.json',
      );
    });

    test('http (non-https) origin', () => {
      expect(
        joinPublicPath(
          'http://192.168.1.128:3010/',
          '.rspeedy/main/main-thread.js.map',
        ),
      ).toBe('http://192.168.1.128:3010/.rspeedy/main/main-thread.js.map');
    });

    test('accepts custom schemes (file://, etc.)', () => {
      expect(
        joinPublicPath('file:///srv/static/', 'a/b.json'),
      ).toBe('file:///srv/static/a/b.json');
    });

    test('strips leading slashes on the relative path before delegating to new URL', () => {
      expect(
        joinPublicPath('https://example.com/x/', '/foo/bar.js'),
      ).toBe('https://example.com/x/foo/bar.js');
    });
  });

  describe('path-style publicPath', () => {
    test('absolute path like /assets/ does NOT throw (the bug #12 fix)', () => {
      expect(
        joinPublicPath('/assets/', '.rspeedy/main/debug-metadata.json'),
      ).toBe('/assets/.rspeedy/main/debug-metadata.json');
    });

    test('strips trailing slash from publicPath', () => {
      expect(joinPublicPath('/assets/', 'foo.js')).toBe('/assets/foo.js');
      expect(joinPublicPath('/assets', 'foo.js')).toBe('/assets/foo.js');
    });

    test('strips leading slashes from relPath to avoid double-slashing', () => {
      expect(joinPublicPath('/assets', '/foo.js')).toBe('/assets/foo.js');
      expect(joinPublicPath('/assets', '///foo.js')).toBe('/assets/foo.js');
    });

    test('root-only publicPath "/"', () => {
      expect(joinPublicPath('/', 'foo.js')).toBe('/foo.js');
    });
  });

  describe('relative-path publicPath', () => {
    test('bare relative prefix like static/', () => {
      expect(joinPublicPath('static/', 'foo.js')).toBe('static/foo.js');
    });

    test('empty publicPath', () => {
      expect(joinPublicPath('', 'foo.js')).toBe('/foo.js');
    });
  });
});
