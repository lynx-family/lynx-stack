// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import * as runtimeLoadRuntimeModule from '../../runtime/src/worklet-runtime/bindings/loadRuntime';
import * as runtimeWorkletRuntimeModule from '../../runtime/src/worklet-runtime/workletRuntime';
import * as facadeLoadRuntimeModule from '../src/bindings/loadRuntime';
import * as facadeWorkletRuntimeModule from '../src/workletRuntime';

describe('source ownership', () => {
  it('should expose the core worklet runtime implementation from runtime ownership', () => {
    expect(Object.keys(runtimeWorkletRuntimeModule)).toEqual(
      Object.keys(facadeWorkletRuntimeModule),
    );
  });

  it('should expose loadRuntime bindings from runtime ownership', () => {
    expect(Object.keys(runtimeLoadRuntimeModule)).toEqual(
      Object.keys(facadeLoadRuntimeModule),
    );
  });
});
