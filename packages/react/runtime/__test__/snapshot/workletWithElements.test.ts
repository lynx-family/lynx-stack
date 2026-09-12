// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { updateGesture } from '../../src/snapshot/snapshot/gesture';
import { updateWorkletEvent } from '../../src/snapshot/snapshot/workletEvent';
import { updateWorkletRef, workletUnRef } from '../../src/snapshot/snapshot/workletRef';

function createSnapshot(value: unknown) {
  return {
    __id: 1,
    __values: [value],
    __elements: [{}],
    type: 'TestSnapshot',
  } as never;
}

describe('worklet updates on materialized snapshots', () => {
  beforeEach(() => {
    globalThis.lynxWorkletImpl = {
      _jsFunctionLifecycleManager: { addRef: rs.fn() },
    } as never;
  });

  afterEach(() => {
    rs.restoreAllMocks();
    delete globalThis.lynxWorkletImpl;
  });

  it('does not process background-thread gestures on materialized elements', () => {
    const gesture = {
      __isSerialized: true,
      callbacks: { onUpdate: { _execId: 1, _wkltId: 'bg' } },
      id: 1,
      type: 0,
    };

    expect(() => updateGesture(createSnapshot(gesture), 0, undefined, 0, 'background')).not.toThrow();
  });

  it('does not add background-thread worklet events on materialized elements', () => {
    const addEvent = rs.fn();
    rs.stubGlobal('__AddEvent', addEvent);

    try {
      updateWorkletEvent(
        createSnapshot({ _execId: 2, _wkltId: 'bg-event' }),
        0,
        undefined,
        0,
        'bindEvent',
        'tap',
        'background',
      );

      expect(addEvent).not.toHaveBeenCalled();
    } finally {
      rs.unstubAllGlobals();
    }
  });

  it('accepts a pre-0.99 lepus worklet ref without throwing', () => {
    rs.stubGlobal('__SetAttribute', rs.fn());

    try {
      expect(() =>
        updateWorkletRef(
          createSnapshot({ _type: '__LEPUS__' }),
          0,
          undefined,
          0,
          false,
        )
      ).not.toThrow();
    } finally {
      rs.unstubAllGlobals();
    }
  });

  it('ignores unref for a value that is neither a ref nor a worklet', () => {
    expect(() => workletUnRef({ _type: '__LEPUS__' } as never)).not.toThrow();
  });
});
