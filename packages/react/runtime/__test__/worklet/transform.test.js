// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { destroyWorklet } from '../../src/worklet/jsImpl';
import { transformToWorklet } from '../../src/worklet/transformToWorklet';

afterEach(() => {
  destroyWorklet();
});

describe('WorkletJsFnTransform', () => {
  it('should transform js fn', () => {
    const fn = vi.fn();
    let result = transformToWorklet(fn);
    expect(result._fn).toBe(fn);
    expect(result._jsFnId).toEqual(1);

    result = transformToWorklet(fn);
    expect(result._fn).toBe(fn);
    expect(result._jsFnId).toEqual(2);
  });

  it('should not transform js fn when native capabilities not available', () => {
    const getCoreContext = lynx.getCoreContext;
    lynx.getCoreContext = undefined;

    const fn = vi.fn();
    let result = transformToWorklet(fn);
    expect(result._jsFnId).toEqual(0);

    result = transformToWorklet(fn);
    expect(result._jsFnId).toEqual(0);

    lynx.getCoreContext = getCoreContext;
  });

  it('should raise error when argument is not a function', () => {
    const x = transformToWorklet(1);
    expect(x._error).toMatch('Argument of runOnBackground should be a function, but got [number] instead');
  });
});
