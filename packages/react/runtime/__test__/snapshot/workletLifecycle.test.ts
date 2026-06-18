// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, rstest as vi } from '@rstest/core';

import { updateGesture } from '../../src/snapshot/snapshot/gesture';
import { updateSpread } from '../../src/snapshot/snapshot/spread';
import { updateWorkletEvent } from '../../src/snapshot/snapshot/workletEvent';
import { updateWorkletRef } from '../../src/snapshot/snapshot/workletRef';

function createSnapshot(value: unknown) {
  return {
    __id: 1,
    __values: [value],
    type: 'TestSnapshot',
  } as any;
}

describe('worklet lifecycle without elements', () => {
  let addRef: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addRef = vi.fn();
    globalThis.lynxWorkletImpl = {
      _jsFunctionLifecycleManager: {
        addRef,
      },
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.lynxWorkletImpl;
  });

  it('retains main-thread event worklet ctx before elements are materialized', () => {
    const worklet = {
      _execId: 1,
      _wkltId: 'event',
    };

    updateWorkletEvent(createSnapshot(worklet), 0, undefined as any, 0, 'main-thread', 'bindEvent', 'tap');

    expect(addRef).toHaveBeenCalledTimes(1);
    expect(addRef).toHaveBeenCalledWith(1, worklet);
  });

  it('retains main-thread ref worklet ctx before elements are materialized', () => {
    const worklet = {
      _execId: 2,
      _wkltId: 'ref',
    };

    updateWorkletRef(createSnapshot(worklet), 0, undefined, 0, 'main-thread');

    expect(addRef).toHaveBeenCalledTimes(1);
    expect(addRef).toHaveBeenCalledWith(2, worklet);
  });

  it('retains main-thread gesture callbacks before elements are materialized', () => {
    const callback = {
      _execId: 3,
      _wkltId: 'gesture',
    };
    const gesture = {
      __isSerialized: true,
      callbacks: {
        onUpdate: callback,
      },
      id: 1,
      type: 0,
    };

    updateGesture(createSnapshot(gesture), 0, undefined, 0, 'main-thread');

    expect(addRef).toHaveBeenCalledTimes(1);
    expect(addRef).toHaveBeenCalledWith(3, callback);
  });

  it('retains main-thread spread worklet ctx before elements are materialized', () => {
    const eventWorklet = {
      _execId: 4,
      _wkltId: 'spread-event',
    };
    const refWorklet = {
      _execId: 5,
      _wkltId: 'spread-ref',
    };
    const gestureCallback = {
      _execId: 6,
      _wkltId: 'spread-gesture',
    };
    const gesture = {
      __isSerialized: true,
      callbacks: {
        onUpdate: gestureCallback,
      },
      id: 1,
      type: 0,
    };

    updateSpread(
      createSnapshot({
        'main-thread:bindtap': eventWorklet,
        'main-thread:gesture': gesture,
        'main-thread:ref': refWorklet,
      }),
      0,
      {},
      0,
    );

    expect(addRef.mock.calls).toEqual([
      [4, eventWorklet],
      [6, gestureCallback],
      [5, refWorklet],
    ]);
  });

  it('does not retain unchanged spread worklet ctx again before elements are materialized', () => {
    const eventWorklet = {
      _execId: 7,
      _wkltId: 'spread-event',
    };
    const spread = {
      'main-thread:bindtap': eventWorklet,
    };

    updateSpread(createSnapshot(spread), 0, spread, 0);

    expect(addRef).not.toHaveBeenCalled();
  });
});
