import { describe, it, expect } from 'vitest';
import { prettyFormatSnapshotPatch } from '../../src/debug/formatPatch.js';
import { SnapshotOperation } from '../../src/lifecycle/patch/snapshotPatch.js';

describe('formatPatch', () => {
  it('should format all operation types', () => {
    const snapshotPatch = [
      SnapshotOperation.CreateElement,
      'span',
      2,
      0,
      SnapshotOperation.InsertBefore,
      1,
      2,
      undefined,
      SnapshotOperation.RemoveChild,
      1,
      2,
      SnapshotOperation.SetAttribute,
      2,
      1,
      'disabled',
      SnapshotOperation.SetAttributes,
      2,
      { hidden: true },
      SnapshotOperation.DEV_ONLY_AddSnapshot,
      'unique-1',
      'create-val',
      ['update-val'],
      [],
      123,
      'entry-1',
      SnapshotOperation.DEV_ONLY_RegisterWorklet,
      'hash-1',
      '() => {}',
    ];
    const formatted = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formatted).toEqual([
      { op: 'CreateElement', type: 'span', id: 2, slotIndex: 0 },
      { op: 'InsertBefore', parentId: 1, childId: 2, beforeId: undefined },
      { op: 'RemoveChild', parentId: 1, childId: 2 },
      { op: 'SetAttribute', id: 2, dynamicPartIndex: 1, value: 'disabled' },
      { op: 'SetAttributes', id: 2, values: { hidden: true } },
      {
        op: 'DEV_ONLY_AddSnapshot',
        uniqID: 'unique-1',
        create: 'create-val',
        update: ['update-val'],
        slot: [],
        cssId: 123,
        entryName: 'entry-1',
      },
      {
        op: 'DEV_ONLY_RegisterWorklet',
        hash: 'hash-1',
        fnStr: '() => {}',
      },
    ]);
  });

  it('should return an empty array for an undefined patch', () => {
    const formatted = prettyFormatSnapshotPatch(undefined);
    expect(formatted).toEqual([]);
  });

  it('should return an empty array for an empty patch', () => {
    const formatted = prettyFormatSnapshotPatch([]);
    expect(formatted).toEqual([]);
  });

  it('should throw an error for unknown operations', () => {
    const snapshotPatch = [
      999, // Unknown operation
    ];
    expect(() => prettyFormatSnapshotPatch(snapshotPatch)).toThrow(
      'Unknown snapshot operation: 999',
    );
  });
});
