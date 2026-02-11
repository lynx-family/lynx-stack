import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamicPartType } from '../../src/snapshot/dynamicPartType.js';
import { createSnapshot, SnapshotInstance } from '../../src/snapshot.js';
import { globalEnvManager } from '../utils/envManager.js';

describe('removeChild value clearing', () => {
  beforeEach(() => {
    globalEnvManager.resetEnv();
  });

  it('clears values with updater before instance deletion', () => {
    const parentType = 'removeChildClearValues-parent';
    const childType = 'removeChildClearValues-child';

    const updater0 = vi.fn((ctx: SnapshotInstance, index: number, _oldValue: unknown) => {
      expect(ctx.__values?.[index]).toBeUndefined();
    });
    const updater1 = vi.fn();
    const updater2 = vi.fn((ctx: SnapshotInstance, index: number, _oldValue: unknown) => {
      expect(ctx.__values?.[index]).toBeUndefined();
    });

    createSnapshot(
      parentType,
      null,
      [],
      [[DynamicPartType.ListChildren, 0]],
      undefined,
      undefined,
      null,
      true,
    );

    createSnapshot(
      childType,
      null,
      [updater0, updater1, updater2] as any,
      [],
      undefined,
      undefined,
      null,
      true,
    );

    const parent = new SnapshotInstance(parentType);
    const child = new SnapshotInstance(childType);
    child.__values = [1, undefined, { __spread: {}, a: 1 }];

    parent.insertBefore(child);
    parent.removeChild(child);

    expect(updater0).toHaveBeenCalledTimes(1);
    expect(updater0).toHaveBeenCalledWith(child, 0, 1);
    expect(updater1).toHaveBeenCalledTimes(0);
    expect(updater2).toHaveBeenCalledTimes(1);
    expect(updater2).toHaveBeenCalledWith(child, 2, { __spread: {}, a: 1 });

    expect(child.__values?.[2]).toEqual(undefined);
  });
});
