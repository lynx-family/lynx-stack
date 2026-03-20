// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adoptSlotChildren } from '../src/slot.js';

// Mock globals
globalThis.__DEV__ = true;
globalThis.__AppendElement = vi.fn();

describe('adoptSlotChildren', () => {
  const mockSnapshotValues = new Map<number, { __element_root?: unknown }>();

  beforeEach(() => {
    mockSnapshotValues.clear();
    vi.restoreAllMocks();
  });

  it('should adopt slot children by appending their elements to the container', () => {
    const container = { type: 'mtc-boundary' };
    const child1Root = { type: 'view', id: 1 };
    const child2Root = { type: 'text', id: 2 };

    mockSnapshotValues.set(10, { __element_root: child1Root });
    mockSnapshotValues.set(11, { __element_root: child2Root });

    adoptSlotChildren(container, [10, 11], mockSnapshotValues);

    expect(__AppendElement).toHaveBeenCalledTimes(2);
    expect(__AppendElement).toHaveBeenCalledWith(container, child1Root);
    expect(__AppendElement).toHaveBeenCalledWith(container, child2Root);
  });

  it('should be a no-op when slotIds is undefined', () => {
    adoptSlotChildren({}, undefined, mockSnapshotValues);
    expect(__AppendElement).not.toHaveBeenCalled();
  });

  it('should be a no-op when slotIds is empty', () => {
    adoptSlotChildren({}, [], mockSnapshotValues);
    expect(__AppendElement).not.toHaveBeenCalled();
  });

  it('should warn when slot child not found', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    adoptSlotChildren({}, [999], mockSnapshotValues);

    expect(warnSpy).toHaveBeenCalledWith('[MTC] Slot child not found for ID: 999');
    expect(__AppendElement).not.toHaveBeenCalled();
  });

  it('should skip slot children without element_root', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSnapshotValues.set(10, { __element_root: undefined });

    adoptSlotChildren({}, [10], mockSnapshotValues);

    expect(warnSpy).toHaveBeenCalledWith('[MTC] Slot child not found for ID: 10');
    expect(__AppendElement).not.toHaveBeenCalled();
  });
});
