// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion, increaseReloadVersion } from '../../src/core/reload-version.js';
import { commitPatchUpdate } from '../../src/snapshot/lifecycle/patch/commit.js';
import { addCtxNotFoundEventListener } from '../../src/snapshot/lifecycle/patch/error.js';
import {
  SET_ATTRIBUTE_RUN_MIN_SIZE,
  SnapshotOperation,
  SnapshotOperationParams,
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  pushSetAttributeOperation,
  takeGlobalSnapshotPatch,
} from '../../src/snapshot/lifecycle/patch/snapshotPatch.js';
import type { SnapshotPatch } from '../../src/snapshot/lifecycle/patch/snapshotPatch.js';
import { snapshotPatchApply } from '../../src/snapshot/lifecycle/patch/snapshotPatchApply.js';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates.js';
import { createSnapshot } from '../../src/snapshot/snapshot/definition.js';
import { updateListItemPlatformInfo } from '../../src/snapshot/snapshot/platformInfo.js';
import { BackgroundSnapshotInstance, hydrate } from '../../src/snapshot/snapshot/backgroundSnapshot.js';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot/snapshot/snapshot.js';
import { globalEnvManager } from './utils/envManager.js';
import { elementTree, nativeMethodQueue } from './utils/nativeMethod.js';

type DynamicPartIndex = number | string;
type AttributeCall = [
  id: number,
  dynamicPartIndex: DynamicPartIndex,
  value: unknown,
];

function createAttributePatch(
  ids: number[],
  dynamicPartIndex: DynamicPartIndex,
  values: unknown[],
): SnapshotPatch {
  const patch: SnapshotPatch = [];
  for (let index = 0; index < ids.length; index++) {
    patch.push(
      SnapshotOperation.SetAttribute,
      ids[index],
      dynamicPartIndex,
      values[index],
    );
  }
  return patch;
}

function recordPatch(snapshotPatch: SnapshotPatch): SnapshotPatch {
  initGlobalSnapshotPatch();
  for (let index = 0; index < snapshotPatch.length;) {
    const operation = snapshotPatch[index];
    if (operation === SnapshotOperation.SetAttribute) {
      pushSetAttributeOperation(
        snapshotPatch[index + 1] as number,
        snapshotPatch[index + 2] as DynamicPartIndex,
        snapshotPatch[index + 3],
      );
      index += 4;
      continue;
    }
    const operationParams = SnapshotOperationParams[operation as number];
    if (!operationParams) {
      __globalSnapshotPatch!.push(...snapshotPatch.slice(index));
      break;
    }
    const params = operationParams.params.length;
    __globalSnapshotPatch!.push(
      ...snapshotPatch.slice(index, index + params + 1),
    );
    index += params + 1;
  }
  return takeGlobalSnapshotPatch()!;
}

const SET_ATTRIBUTE_RUN_THRESHOLD = SET_ATTRIBUTE_RUN_MIN_SIZE;
const SET_ATTRIBUTE_RUN_WIRE_BREAK_EVEN = 2;

function collectAttributeCalls(
  patch: SnapshotPatch,
  availableIds: number[],
): AttributeCall[] {
  snapshotInstanceManager.clear();
  const calls: AttributeCall[] = [];
  for (const id of new Set(availableIds)) {
    snapshotInstanceManager.values.set(
      id,
      {
        setAttribute(dynamicPartIndex: DynamicPartIndex, value: unknown) {
          calls.push([id, dynamicPartIndex, value]);
        },
      } as SnapshotInstance,
    );
  }
  snapshotPatchApply(JSON.parse(JSON.stringify(patch)) as SnapshotPatch);
  return calls;
}

function collectMissingIds(
  patch: SnapshotPatch,
  availableIds: number[],
): number[] {
  const dispatchEvent = vi.mocked(lynx.getJSContext!().dispatchEvent);
  dispatchEvent.mockClear();
  collectAttributeCalls(patch, availableIds);
  return dispatchEvent.mock.calls.map(([event]) => (event.data as { id: number }).id);
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 | 0;
    return state >>> 0;
  };
}

beforeAll(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  addCtxNotFoundEventListener();
  globalEnvManager.switchToMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  nativeMethodQueue.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
  nativeMethodQueue.clear();
});

describe('attribute run recording', () => {
  it('keeps select and small updates byte-for-byte unchanged', () => {
    for (
      const count of [1, 10, SET_ATTRIBUTE_RUN_THRESHOLD - 1]
    ) {
      const ids = Array.from({ length: count }, (_, index) => 100 + index);
      const patch = createAttributePatch(ids, 0, ids);
      const before = JSON.stringify(patch);

      expect(recordPatch(patch)).toEqual(patch);
      expect(JSON.stringify(recordPatch(patch))).toBe(before);
    }

    const oneOpPatch = createAttributePatch([100], 0, ['selected']);
    const patchList = {
      patchList: [{ id: 1, snapshotPatch: oneOpPatch }],
    };
    const expectedData = JSON.stringify(patchList);
    expect(commitPatchUpdate(patchList, {}).data).toBe(expectedData);
    expect(patchList.patchList[0].snapshotPatch).toBe(oneOpPatch);
  });

  it('uses a conservative threshold above the wire break-even', () => {
    expect(SET_ATTRIBUTE_RUN_WIRE_BREAK_EVEN).toBe(2);
    expect(SET_ATTRIBUTE_RUN_THRESHOLD).toBe(16);
    expect(SET_ATTRIBUTE_RUN_THRESHOLD).toBeGreaterThanOrEqual(
      SET_ATTRIBUTE_RUN_WIRE_BREAK_EVEN,
    );

    for (const dynamicPartIndex of [0, 'data-state']) {
      const ids = Array.from(
        { length: SET_ATTRIBUTE_RUN_THRESHOLD },
        (_, index) => 101 + index * 6,
      );
      const values = ids.map((_, index) => index % 2 === 0);
      const legacy = createAttributePatch(ids, dynamicPartIndex, values);
      const columnar = [
        SnapshotOperation.SetAttributeRun,
        dynamicPartIndex,
        ids[0],
        6,
        values,
      ];
      expect(JSON.stringify(columnar).length).toBeLessThan(
        JSON.stringify(legacy).length,
      );
    }

    expect(
      JSON.stringify([
        SnapshotOperation.SetAttributeRun,
        0,
        101,
        6,
        [false, true],
      ]).length,
    ).toBeLessThan(
      JSON.stringify(createAttributePatch([101, 107], 0, [false, true])).length,
    );
  });

  it('keeps non-arithmetic object updates in the legacy representation', () => {
    const ids = [
      2,
      5,
      9,
      9,
      15,
      22,
      31,
      43,
      58,
      76,
      97,
      121,
      148,
      178,
      211,
      247,
    ];
    const values = ids.map((id, index) => ({ id, index }));
    const patch = createAttributePatch(ids, 'extra-prop', values);

    const encoded = recordPatch(patch);

    expect(encoded).toEqual(patch);
    values.forEach((value, index) => {
      expect(encoded[index * 4 + 3]).toBe(value);
    });
  });

  it('uses arithmetic ids only after proving the complete safe-integer run', () => {
    const values = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD + 2 },
      (_, index) => `value-${index}`,
    );
    const arithmeticIds = values.map((_, index) => 1000 + index * 7);
    const descendingIds = values.map((_, index) => 1000 - index * 7);
    const duplicateIds = values.map(() => 42);

    expect(
      recordPatch(createAttributePatch(arithmeticIds, 0, values)),
    ).toEqual([
      SnapshotOperation.SetAttributeRun,
      0,
      1000,
      7,
      values,
    ]);
    expect(
      recordPatch(createAttributePatch(descendingIds, 0, values)),
    ).toEqual([
      SnapshotOperation.SetAttributeRun,
      0,
      1000,
      -7,
      values,
    ]);
    expect(
      recordPatch(createAttributePatch(duplicateIds, 0, values)),
    ).toEqual([
      SnapshotOperation.SetAttributeRun,
      0,
      42,
      0,
      values,
    ]);

    const mismatchedIds = [...arithmeticIds];
    mismatchedIds[7]!++;
    expect(
      recordPatch(createAttributePatch(mismatchedIds, 0, values))[0],
    ).toBe(SnapshotOperation.SetAttribute);

    const unsafeFirstIds = [...arithmeticIds];
    unsafeFirstIds[0] = Number.MAX_SAFE_INTEGER + 1;
    expect(
      recordPatch(createAttributePatch(unsafeFirstIds, 0, values))[0],
    ).toBe(SnapshotOperation.SetAttribute);

    const unsafeSecondIds = [...arithmeticIds];
    unsafeSecondIds[1] = Number.MAX_SAFE_INTEGER + 1;
    expect(
      recordPatch(createAttributePatch(unsafeSecondIds, 0, values))[0],
    ).toBe(SnapshotOperation.SetAttribute);

    const unsafeStepIds = values.map((_, index) => index === 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
    expect(
      recordPatch(createAttributePatch(unsafeStepIds, 0, values))[0],
    ).toBe(SnapshotOperation.SetAttribute);

    const overflowingIds = values.map(
      (_, index) => Number.MAX_SAFE_INTEGER - 5 + index * 2,
    );
    expect(
      recordPatch(createAttributePatch(overflowingIds, 0, values))[0],
    ).toBe(SnapshotOperation.SetAttribute);
  });

  it('keeps object and function values in legacy slots with original identity', () => {
    const ref = Object.assign(() => {}, { __ref: 'ref-1' });
    const spread = {
      __spread: { id: 'spread' },
      ref,
    };
    const worklet = { _wkltId: 'worklet-1', _execId: 3 };
    const gesture = { __isGesture: true, id: 4 };
    const timingFlag = { __ltf: 1 };
    const toJSON = vi.fn(() => ({ serialized: true }));
    const withToJSON = { toJSON };
    const values = [
      undefined,
      null,
      false,
      0,
      ref,
      spread,
      worklet,
      gesture,
      timingFlag,
      withToJSON,
      ['list', null],
      { heterogeneous: true },
      'text',
      17,
      true,
      { nested: [null, undefined] },
    ];
    const ids = [
      1,
      3,
      6,
      10,
      15,
      21,
      28,
      36,
      45,
      55,
      66,
      78,
      91,
      105,
      120,
      136,
    ];
    const legacy = createAttributePatch(ids, 'extra-prop', values);
    const encoded = recordPatch(legacy);

    values.forEach((value, index) => {
      expect(encoded[index * 4 + 3]).toBe(value);
    });
    expect(encoded).toHaveLength(legacy.length);

    const legacyCalls = collectAttributeCalls(legacy, ids);
    expect(toJSON).toHaveBeenCalledTimes(1);
    toJSON.mockClear();
    const encodedCalls = collectAttributeCalls(encoded, ids);
    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(encodedCalls).toEqual(legacyCalls);
  });

  it('preserves the legacy toJSON key for object values', () => {
    const toJSON = vi.fn(function(this: { value: string }, key: string) {
      return `${key}:${this.value}`;
    });
    const values = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => ({ value: `value-${index}`, toJSON }),
    );
    const ids = values.map((_, index) => 1_000 + index * 3);
    const legacy = createAttributePatch(ids, 0, values);
    const recorded = recordPatch(legacy);

    JSON.stringify(legacy);
    const legacyKeys = toJSON.mock.calls.map(([key]) => key);
    toJSON.mockClear();
    JSON.stringify(recorded);

    expect(recorded).toEqual(legacy);
    expect(toJSON.mock.calls.map(([key]) => key)).toEqual(legacyKeys);
  });

  it('records a real BackgroundSnapshotInstance arithmetic run', () => {
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
    const instances = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      () => new BackgroundSnapshotInstance('view'),
    );
    takeGlobalSnapshotPatch();
    initGlobalSnapshotPatch();
    const values = instances.map((_, index) => `value-${index}`);

    instances.forEach((instance, index) => {
      instance.setAttribute('data-state', values[index]);
    });

    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.SetAttributeRun,
      'data-state',
      instances[0]!.__id,
      1,
      values,
    ]);
  });

  it('preserves barriers, duplicate order, and multiple batches', () => {
    const firstIds = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => index + 1,
    );
    const secondIds = [
      4,
      2,
      4,
      8,
      3,
      8,
      1,
      7,
      5,
      6,
      2,
      9,
      3,
      10,
      1,
      11,
    ];
    const first = createAttributePatch(firstIds, 0, firstIds);
    const second = createAttributePatch(
      secondIds,
      'extra-prop',
      secondIds.map((id, index) => `${id}:${index}`),
    );
    const legacy = [
      ...first,
      SnapshotOperation.SetAttributes,
      4,
      ['barrier'],
      ...second,
      SnapshotOperation.SetAttribute,
      6,
      1,
      'tail',
    ];

    const encoded = recordPatch(legacy);

    expect(encoded).toEqual([
      SnapshotOperation.SetAttributeRun,
      0,
      1,
      1,
      firstIds,
      SnapshotOperation.SetAttributes,
      4,
      ['barrier'],
      ...second,
      SnapshotOperation.SetAttribute,
      6,
      1,
      'tail',
    ]);
    expect(collectAttributeCalls(encoded, firstIds)).toEqual(
      collectAttributeCalls(legacy, firstIds),
    );
  });

  it('leaves unknown patches untouched', () => {
    const patch = [999, 'unknown'];
    expect(recordPatch(patch)).toEqual(patch);
  });

  it('is equivalent across deterministic heterogeneous properties', () => {
    for (let seed = 1; seed <= 128; seed++) {
      const random = createRandom(seed);
      const count = SET_ATTRIBUTE_RUN_THRESHOLD + random() % 23;
      const dynamicPartIndex = seed % 2 === 0
        ? random() % 5
        : `extra-${random() % 5}`;
      const ids = Array.from({ length: count }, () => (random() % 31) - 15);
      const values = Array.from({ length: count }, (_, index) => {
        switch (random() % 7) {
          case 0:
            return undefined;
          case 1:
            return null;
          case 2:
            return random() % 2 === 0;
          case 3:
            return (random() % 200) - 100;
          case 4:
            return `value-${seed}-${index}`;
          case 5:
            return [seed, index, null];
          default:
            return { seed, index, enabled: index % 2 === 0 };
        }
      });
      const legacy = createAttributePatch(ids, dynamicPartIndex, values);
      const encoded = recordPatch(legacy);

      expect(collectAttributeCalls(encoded, ids)).toEqual(
        collectAttributeCalls(legacy, ids),
      );
    }
  });
});

describe('snapshotPatchApply attribute runs', () => {
  it.each([
    ['invalid key', {}, 100, 3, [true, false]],
    ['invalid first id', 0, '100', 3, [true, false]],
    ['invalid step', 0, 100, Number.POSITIVE_INFINITY, [true, false]],
    ['invalid values', 0, 100, 3, { value: true }],
    ['short values', 0, 100, 3, [true]],
    ['object value', 0, 100, 3, [true, { value: false }]],
    ['overflowing id', 0, Number.MAX_SAFE_INTEGER, 1, [true, false]],
  ])('rejects %s before applying any update', (
    _name,
    dynamicPartIndex,
    firstId,
    idStep,
    values,
  ) => {
    const setAttribute = vi.fn();
    snapshotInstanceManager.values.set(
      100,
      { setAttribute } as unknown as SnapshotInstance,
    );
    const reportError = vi.mocked(_ReportError);
    reportError.mockClear();

    snapshotPatchApply([
      SnapshotOperation.SetAttributeRun,
      dynamicPartIndex,
      firstId,
      idStep,
      values,
    ]);

    expect(setAttribute).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('invalid SetAttributeRun'),
      }),
    );
  });

  it('reports every missing arithmetic-run id in operation order', () => {
    const ids = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => 100 + index * 3,
    );
    const availableIds = ids.filter(id => ![106, 121].includes(id));
    const encoded = recordPatch(
      createAttributePatch(ids, 0, ids),
    );

    expect(encoded[0]).toBe(SnapshotOperation.SetAttributeRun);
    expect(collectMissingIds(encoded, availableIds)).toEqual([106, 121]);
  });

  it('makes one platform SetAttribute call per exact update', () => {
    const snapshotType = createSnapshot(
      'attribute-batch-platform-calls',
      () => [__CreateView(0)],
      [
        ctx => {
          __SetAttribute(
            ctx.__elements![0]!,
            'batch-value',
            ctx.__values![0],
          );
        },
      ],
      [],
      undefined,
      undefined,
      null,
      true,
    );
    const ids = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => 200 + index,
    );
    const values = ids.map(id => `value-${id}`);
    for (const id of ids) {
      new SnapshotInstance(snapshotType, id).ensureElements();
    }
    const setAttribute = vi.spyOn(globalThis, '__SetAttribute');

    snapshotPatchApply(
      JSON.parse(
        JSON.stringify(
          recordPatch(createAttributePatch(ids, 0, values)),
        ),
      ) as SnapshotPatch,
    );

    expect(setAttribute).toHaveBeenCalledTimes(ids.length);
    expect(
      setAttribute.mock.calls.map(([, key, value]) => [key, value]),
    ).toEqual(values.map(value => ['batch-value', value]));
  });

  it('retains list-item platform bookkeeping', () => {
    const itemType = createSnapshot(
      'attribute-batch-list-item',
      () => [__CreateElement('list-item', 0)],
      [
        (ctx, index, oldValue) => {
          updateListItemPlatformInfo(ctx, index, oldValue, 0);
        },
      ],
      [],
      undefined,
      undefined,
      null,
      true,
    );
    const list = new SnapshotInstance('list', 500);
    const ids = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => 600 + index,
    );
    for (const id of ids) {
      const item = new SnapshotInstance(itemType, id);
      item.setAttribute(0, {
        'item-key': `old-${id}`,
        'full-span': false,
      });
      list.insertBefore(item);
    }
    __pendingListUpdates.clear(list.__id);
    const values = ids.map(id => ({
      'item-key': `new-${id}`,
      'full-span': id % 2 === 0,
    }));

    snapshotPatchApply(
      recordPatch(createAttributePatch(ids, 0, values)),
    );

    const updates = (
      JSON.parse(
        JSON.stringify(__pendingListUpdates.values?.[list.__id]),
      ) as Array<{ updateAction: Array<Record<string, unknown>> }>
    )[0]?.updateAction;
    expect(updates).toHaveLength(ids.length);
    expect(
      updates?.map(update => ({
        itemKey: update['item-key'],
        fullSpan: update['full-span'],
        from: update.from,
        to: update.to,
      })),
    ).toEqual(
      ids.map((id, index) => ({
        itemKey: `new-${id}`,
        fullSpan: id % 2 === 0,
        from: index,
        to: index,
      })),
    );
  });

  it('encodes repeated updates produced by hydration', () => {
    const itemType = createSnapshot(
      'attribute-batch-hydration',
      () => [__CreateView(0)],
      [() => {}],
      [],
      undefined,
      undefined,
      null,
      true,
    );
    const ids = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => 700 + index * 2,
    );
    const before = {
      id: -1,
      type: 'root',
      children: ids.map(id => ({
        id,
        type: itemType,
        values: [`old-${id}`],
      })),
    };
    globalEnvManager.switchToBackground();
    const after = new BackgroundSnapshotInstance('root');
    for (const id of ids) {
      const item = new BackgroundSnapshotInstance(itemType);
      item.setAttribute('values', [`new-${id}`]);
      after.insertBefore(item);
    }

    const hydrationPatch = hydrate(before, after);
    const result = commitPatchUpdate({
      patchList: [{ id: 9, snapshotPatch: hydrationPatch }],
    }, {
      isHydration: true,
      flowIds: [17, 23],
    });
    const parsed = JSON.parse(result.data);

    expect(hydrationPatch).toHaveLength(5);
    expect(parsed.patchList[0].snapshotPatch).toEqual([
      SnapshotOperation.SetAttributeRun,
      0,
      ids[0],
      2,
      ids.map(id => `new-${id}`),
    ]);
    expect(result.patchOptions).toEqual({
      isHydration: true,
      flowIds: [17, 23],
      reloadVersion: getReloadVersion(),
    });
  });

  it('does not scan manually supplied patches at a nonzero reload epoch', () => {
    const ids = Array.from(
      { length: SET_ATTRIBUTE_RUN_THRESHOLD },
      (_, index) => 900 + index * 2,
    );
    const reloadVersion = increaseReloadVersion();
    const patchList = {
      patchList: [{
        id: 9,
        snapshotPatch: createAttributePatch(ids, 0, ids),
      }],
    };

    const result = commitPatchUpdate(patchList, {
      flowIds: [29],
    });
    const parsed = JSON.parse(result.data);

    expect(parsed.patchList[0].snapshotPatch).toEqual(
      createAttributePatch(ids, 0, ids),
    );
    expect(result.patchOptions).toEqual({
      flowIds: [29],
      reloadVersion,
    });
  });
});
