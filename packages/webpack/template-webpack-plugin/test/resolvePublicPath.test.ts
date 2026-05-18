// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { resolvePublicPath } from '../src/LynxTemplatePlugin.js';

const SAMPLE_PATH_DATA = {
  chunk: {
    name: 'main',
    hash: 'abc123',
    contentHash: { javascript: 'def456' },
  },
  hash: 'compilation-hash',
  contentHash: { javascript: 'def456' },
};

describe('resolvePublicPath', () => {
  describe('string publicPath', () => {
    test('absolute URL passes through', () => {
      expect(
        resolvePublicPath('https://cdn.example.com/', SAMPLE_PATH_DATA),
      ).toBe('https://cdn.example.com/');
    });

    test('path-style passes through', () => {
      expect(resolvePublicPath('/assets/', SAMPLE_PATH_DATA))
        .toBe('/assets/');
    });

    test('root "/" passes through (caller decides what to do with it)', () => {
      expect(resolvePublicPath('/', SAMPLE_PATH_DATA)).toBe('/');
    });

    test('empty string passes through', () => {
      expect(resolvePublicPath('', SAMPLE_PATH_DATA)).toBe('');
    });
  });

  describe('"auto" / missing', () => {
    test('"auto" → undefined (resolved at runtime, not buildtime)', () => {
      expect(resolvePublicPath('auto', SAMPLE_PATH_DATA)).toBeUndefined();
    });

    test('undefined input → undefined', () => {
      expect(resolvePublicPath(undefined, SAMPLE_PATH_DATA)).toBeUndefined();
    });

    test('non-string non-function (e.g. number, object) → undefined', () => {
      expect(resolvePublicPath(123, SAMPLE_PATH_DATA)).toBeUndefined();
      expect(resolvePublicPath({}, SAMPLE_PATH_DATA)).toBeUndefined();
      expect(resolvePublicPath(null, SAMPLE_PATH_DATA)).toBeUndefined();
    });
  });

  describe('function publicPath', () => {
    test('called with the supplied pathData', () => {
      let captured: unknown;
      const fn = (data: unknown): string => {
        captured = data;
        return 'https://from-fn.example.com/';
      };
      const out = resolvePublicPath(fn, SAMPLE_PATH_DATA);
      expect(out).toBe('https://from-fn.example.com/');
      expect(captured).toBe(SAMPLE_PATH_DATA);
    });

    test('reads chunk.hash from pathData (the common user pattern)', () => {
      expect(resolvePublicPath(chunkHashPublicPath, SAMPLE_PATH_DATA))
        .toBe('https://cdn.example.com/abc123/');
    });

    test('returning a non-string → undefined', () => {
      expect(
        resolvePublicPath(() => 42 as unknown as string, SAMPLE_PATH_DATA),
      ).toBeUndefined();
      expect(
        resolvePublicPath(
          () => null as unknown as string,
          SAMPLE_PATH_DATA,
        ),
      ).toBeUndefined();
    });

    test('throwing function does not crash — returns undefined', () => {
      expect(resolvePublicPath(throwingPublicPath, SAMPLE_PATH_DATA))
        .toBeUndefined();
    });

    test('function accessing missing pathData field that returns undefined → caller-side guard kicks in', () => {
      expect(resolvePublicPath(missingFieldPublicPath, SAMPLE_PATH_DATA))
        .toBeUndefined();
    });
  });
});

function chunkHashPublicPath(
  { chunk }: { chunk: { hash: string } },
): string {
  return `https://cdn.example.com/${chunk.hash}/`;
}

function throwingPublicPath(): string {
  throw new Error('cannot resolve without runtime');
}

function missingFieldPublicPath(
  { missing }: { missing?: { x: number } },
): string {
  // @ts-expect-error intentional null deref to test catch path
  return `cdn/${missing.x}`;
}
