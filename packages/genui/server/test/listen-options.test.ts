// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { resolveListenOptions } from '../src/listen-options.js';

describe('resolveListenOptions', () => {
  test('prefers LYNX_USE_HOST and LYNX_USE_PORT', () => {
    expect(resolveListenOptions({
      HOST: '0.0.0.0',
      LYNX_USE_HOST: '127.0.0.1',
      LYNX_USE_PORT: '4321',
      PORT: '3000',
    })).toEqual({
      hostname: '127.0.0.1',
      port: 4_321,
    });
  });

  test('falls back to HOST and PORT', () => {
    expect(resolveListenOptions({
      HOST: '127.0.0.2',
      PORT: '8080',
    })).toEqual({
      hostname: '127.0.0.2',
      port: 8_080,
    });
  });

  test('uses the server defaults when no listen environment is provided', () => {
    expect(resolveListenOptions({})).toEqual({
      hostname: '0.0.0.0',
      port: 3_000,
    });
  });

  test('reports an invalid LYNX_USE_PORT value', () => {
    expect(() =>
      resolveListenOptions({
        LYNX_USE_PORT: 'not-a-port',
        PORT: '3000',
      })
    ).toThrow('Invalid LYNX_USE_PORT value: not-a-port');
  });
});
