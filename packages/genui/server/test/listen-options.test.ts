// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { resolveListenOptions } from '../src/listen-options.js';

describe('resolveListenOptions', () => {
  test('reads HOST and PORT', () => {
    expect(resolveListenOptions({
      HOST: '127.0.0.1',
      PORT: '4321',
    })).toEqual({
      hostname: '127.0.0.1',
      port: 4_321,
    });
  });

  test('uses the server defaults when no listen environment is provided', () => {
    expect(resolveListenOptions({})).toEqual({
      hostname: '0.0.0.0',
      port: 3_000,
    });
  });

  test('reports an invalid PORT value', () => {
    expect(() =>
      resolveListenOptions({
        PORT: 'not-a-port',
      })
    ).toThrow('Invalid PORT value: not-a-port');
  });
});
