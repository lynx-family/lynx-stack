// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { resolveListenOptions } from '../src/listen-options.js';

describe('resolveListenOptions', () => {
  test('reads LYNX_USE_HOST and LYNX_USE_PORT', () => {
    expect(resolveListenOptions({
      LYNX_USE_HOST: '127.0.0.1',
      LYNX_USE_PORT: '4321',
    })).toEqual({
      hostname: '127.0.0.1',
      port: 4_321,
    });
  });

  test('uses the server defaults when no listen environment is provided', () => {
    expect(resolveListenOptions({})).toEqual({
      hostname: '::',
      port: 3_000,
    });
  });

  test('accepts an explicit IPv6 host', () => {
    expect(resolveListenOptions({
      LYNX_USE_HOST: '::1',
    })).toEqual({
      hostname: '::1',
      port: 3_000,
    });
  });

  test('does not use HOST as a compatibility fallback', () => {
    expect(resolveListenOptions({
      HOST: '127.0.0.1',
    })).toEqual({
      hostname: '::',
      port: 3_000,
    });
  });

  test('reports an invalid LYNX_USE_PORT value', () => {
    expect(() =>
      resolveListenOptions({
        LYNX_USE_PORT: 'not-a-port',
      })
    ).toThrow('Invalid LYNX_USE_PORT value: not-a-port');
  });

  test('rejects blank LYNX_USE_PORT values', () => {
    for (const value of ['', '   ']) {
      expect(() =>
        resolveListenOptions({
          LYNX_USE_PORT: value,
        })
      ).toThrow(`Invalid LYNX_USE_PORT value: ${value}`);
    }
  });
});
