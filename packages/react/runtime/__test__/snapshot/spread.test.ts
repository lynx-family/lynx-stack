// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';

import { transformSpread } from '../../src/snapshot/snapshot/spread.js';
import type { BackgroundSnapshotInstance } from '../../src/snapshot/snapshot/backgroundSnapshot.js';

describe('snapshot spread attribute names', () => {
  const snapshot = { __id: 1 } as BackgroundSnapshotInstance;

  beforeEach(() => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = false;
  });

  it('converts camelCase spread attribute names when enabled by the compilation macro', () => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = true;
    expect(transformSpread(snapshot, 0, {
      __spread: true,
      textMaxline: 2,
      clipRadius: 4,
      bindTap: 'event',
      className: 'label',
    })).toEqual({
      'text-maxline': 2,
      'clip-radius': 4,
      bindTap: 'event',
      className: 'label',
      flatten: false,
    });
  });

  it('keeps camelCase spread attribute names when the compilation macro is disabled', () => {
    expect(transformSpread(snapshot, 0, {
      __spread: true,
      textMaxline: 2,
    })).toEqual({ textMaxline: 2 });
  });

  it('uses source order when camelCase and dash-case spread keys collide', () => {
    globalThis.__ENABLE_CAMEL_CASE_ATTRIBUTES__ = true;
    expect(transformSpread(snapshot, 0, {
      __spread: true,
      'text-maxline': 1,
      textMaxline: 2,
    })).toEqual({ 'text-maxline': 2 });
  });
});
