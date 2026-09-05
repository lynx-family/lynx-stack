// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { updateGesture } from '../../src/snapshot/snapshot/gesture';
import { getListItemPlatformInfoFromIndexedValue } from '../../src/snapshot/snapshot/platformInfo';
import { updateSpread } from '../../src/snapshot/snapshot/spread';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates';
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
  let addRef: ReturnType<typeof rs.fn>;

  beforeEach(() => {
    addRef = rs.fn();
    globalThis.lynxWorkletImpl = {
      _jsFunctionLifecycleManager: {
        addRef,
      },
    } as any;
  });

  afterEach(() => {
    rs.restoreAllMocks();
    delete globalThis.lynxWorkletImpl;
    lynx.__runtime_configs__ = { transformBuiltinAttributeNames: false };
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

  it('seeds list-item platform info from spread before elements are materialized', () => {
    const snapshot = createSnapshot({
      'estimated-height-px': '10px',
      'full-span': true,
      id: 'not-platform-info',
      'item-key': 'item-0',
    });

    updateSpread(snapshot, 0, {}, 0, true);

    expect(snapshot.__listItemPlatformInfo).toMatchInlineSnapshot(`
      {
        "estimated-height-px": "10px",
        "full-span": true,
        "item-key": "item-0",
      }
    `);
  });

  it('transforms list-item platform attribute names before extracting spread info', () => {
    lynx.__runtime_configs__ = { transformBuiltinAttributeNames: true };
    const snapshot = createSnapshot({
      __spread: true,
      estimatedHeightPx: 10,
      fullSpan: true,
      itemKey: 'item-0',
    });

    updateSpread(snapshot, 0, {}, 0, true);

    expect(snapshot.__listItemPlatformInfo).toEqual({
      'estimated-height-px': 10,
      'full-span': true,
      'item-key': 'item-0',
    });
    expect(snapshot.__values[0]).toEqual({
      'estimated-height-px': 10,
      'full-span': true,
      'item-key': 'item-0',
    });
  });

  it('does not transform normalized spread platform info again', () => {
    lynx.__runtime_configs__ = {
      transformBuiltinAttributeNames: {
        mode: 'mapping-only',
        rename: {
          itemKey: 'item-key',
          'item-key': 'renamed-item-key',
        },
      },
    };

    expect(
      getListItemPlatformInfoFromIndexedValue(
        { 'item-key': 'item-0' },
        true,
      ),
    ).toEqual({
      'item-key': 'item-0',
    });
  });
  it('does not retain background-thread gesture callbacks', () => {
    const gesture = {
      __isSerialized: true,
      callbacks: {
        onUpdate: { _execId: 7, _wkltId: 'bg-gesture' },
      },
      id: 1,
      type: 0,
    };

    updateGesture(createSnapshot(gesture), 0, undefined, 0, 'background');

    expect(addRef).not.toHaveBeenCalled();
  });

  it('does not retain background-thread event worklet ctx', () => {
    const worklet = {
      _execId: 8,
      _wkltId: 'bg-event',
    };

    updateWorkletEvent(
      createSnapshot(worklet),
      0,
      undefined,
      0,
      'bindEvent',
      'tap',
      'background',
    );

    expect(addRef).not.toHaveBeenCalled();
  });
  it('does not retain background-thread spread ref and gesture entries', () => {
    updateSpread(
      createSnapshot({
        'background:ref': { _execId: 9, _wkltId: 'bg-ref' },
        'background:gesture': {
          __isSerialized: true,
          callbacks: { onUpdate: { _execId: 10, _wkltId: 'bg-gesture' } },
          id: 1,
          type: 0,
        },
      }),
      0,
      {},
      0,
    );

    expect(addRef).not.toHaveBeenCalled();
  });
  it('does not record a list update when the platform info is unchanged', () => {
    const platformInfo = { 'item-key': 'a' };
    const listHolder = {
      __id: -8,
      __snapshot_def: { isListHolder: true },
    };
    const snapshot = {
      __id: 1,
      __values: [{ ...platformInfo }],
      parentNode: listHolder,
      type: 'TestSnapshot',
    } as any;

    updateSpread(snapshot, 0, { ...platformInfo }, 0);

    expect(__pendingListUpdates.values[-8]).toBeUndefined();
  });
});
