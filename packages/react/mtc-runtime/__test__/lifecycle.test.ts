// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initMtcRuntime, registerMTCComponent } from '../src/mtcRuntime.js';
import { componentRegistry, instanceMap, handleMount } from '../src/renderer.js';

// Mock globals
globalThis.__DEV__ = true;
globalThis.lynx = { reportError: vi.fn() } as any;
globalThis.__AppendElement = vi.fn();

describe('MTC lifecycle', () => {
  let registeredHandlers: Map<number, (patch: unknown[], i: number) => number>;
  let destroyTasks: (() => void)[];
  let mockSnapshotValues: Map<number, { __element_root?: unknown }>;

  const mockRegisterPatchHandler = vi.fn((op: number, handler: (patch: unknown[], i: number) => number) => {
    registeredHandlers.set(op, handler);
    return () => {
      registeredHandlers.delete(op);
    };
  });

  beforeEach(() => {
    registeredHandlers = new Map();
    destroyTasks = [];
    mockSnapshotValues = new Map();
    componentRegistry.clear();
    instanceMap.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Run destroy tasks
    for (const task of destroyTasks) {
      task();
    }
  });

  it('should register patch handlers for MTC operations on init', () => {
    initMtcRuntime(mockRegisterPatchHandler, mockSnapshotValues, destroyTasks);

    expect(mockRegisterPatchHandler).toHaveBeenCalledTimes(3);
    // MtcMount=10, MtcUpdate=11, MtcUnmount=12
    expect(registeredHandlers.has(10)).toBe(true);
    expect(registeredHandlers.has(11)).toBe(true);
    expect(registeredHandlers.has(12)).toBe(true);
  });

  it('should register a destroy task', () => {
    initMtcRuntime(mockRegisterPatchHandler, mockSnapshotValues, destroyTasks);
    expect(destroyTasks.length).toBe(1);
  });

  it('should cleanup all instances and unregister handlers on destroy', () => {
    initMtcRuntime(mockRegisterPatchHandler, mockSnapshotValues, destroyTasks);

    // Mount a component
    const factory = vi.fn();
    registerMTCComponent('hash1', factory);
    mockSnapshotValues.set(42, { __element_root: {} });
    handleMount([10, 42, 'hash1', {}], 0, mockSnapshotValues);

    expect(instanceMap.size).toBe(1);
    expect(registeredHandlers.size).toBe(3);

    // Run destroy
    destroyTasks[0]!();

    expect(instanceMap.size).toBe(0);
    expect(registeredHandlers.size).toBe(0);
  });

  it('should dispatch mount/update/unmount through registered handlers', () => {
    initMtcRuntime(mockRegisterPatchHandler, mockSnapshotValues, destroyTasks);

    const factory = vi.fn();
    registerMTCComponent('hash1', factory);
    mockSnapshotValues.set(42, { __element_root: {} });

    // Mount via registered handler
    const mountHandler = registeredHandlers.get(10)!;
    mountHandler([10, 42, 'hash1', { x: 1 }], 0);
    expect(factory).toHaveBeenCalledWith({ x: 1 });
    expect(instanceMap.has(42)).toBe(true);

    // Update via registered handler
    factory.mockClear();
    const updateHandler = registeredHandlers.get(11)!;
    updateHandler([11, 42, { x: 2 }], 0);
    expect(factory).toHaveBeenCalledWith({ x: 2 });

    // Unmount via registered handler
    const unmountHandler = registeredHandlers.get(12)!;
    unmountHandler([12, 42], 0);
    expect(instanceMap.has(42)).toBe(false);
  });
});
