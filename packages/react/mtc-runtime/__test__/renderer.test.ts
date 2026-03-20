// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  registerMTCComponent,
  handleMount,
  handleUpdate,
  handleUnmount,
  cleanupAllInstances,
  componentRegistry,
  instanceMap,
} from '../src/renderer.js';

// Mock globals
globalThis.__DEV__ = true;
globalThis.lynx = { reportError: vi.fn() } as any;
globalThis.__AppendElement = vi.fn();

describe('MTC renderer', () => {
  const mockSnapshotValues = new Map<number, { __element_root?: unknown }>();

  beforeEach(() => {
    componentRegistry.clear();
    instanceMap.clear();
    mockSnapshotValues.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanupAllInstances();
  });

  describe('registerMTCComponent', () => {
    it('should register a component factory', () => {
      const factory = vi.fn();
      registerMTCComponent('hash1', factory);
      expect(componentRegistry.get('hash1')).toBe(factory);
    });
  });

  describe('handleMount', () => {
    it('should mount an MTC component and track the instance', () => {
      const factory = vi.fn();
      registerMTCComponent('hash1', factory);
      mockSnapshotValues.set(42, { __element_root: { type: 'view' } });

      // Patch: [MtcMount(10), snapshotInstanceId, componentHash, propsValues]
      const patch = [10, 42, 'hash1', { color: 'red' }];
      const newIndex = handleMount(patch, 0, mockSnapshotValues);

      expect(newIndex).toBe(3);
      expect(factory).toHaveBeenCalledWith({ color: 'red' });
      expect(instanceMap.has(42)).toBe(true);
    });

    it('should warn when component not found', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockSnapshotValues.set(42, { __element_root: {} });

      const patch = [10, 42, 'unknown-hash', {}];
      handleMount(patch, 0, mockSnapshotValues);

      expect(warnSpy).toHaveBeenCalledWith(
        '[MTC] Component not found for hash: unknown-hash',
      );
    });

    it('should warn when snapshot instance not found', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerMTCComponent('hash1', vi.fn());

      const patch = [10, 999, 'hash1', {}];
      handleMount(patch, 0, mockSnapshotValues);

      expect(warnSpy).toHaveBeenCalledWith(
        '[MTC] Snapshot instance not found for ID: 999',
      );
    });
  });

  describe('handleUpdate', () => {
    it('should update props on an existing MTC instance', () => {
      const factory = vi.fn();
      registerMTCComponent('hash1', factory);
      mockSnapshotValues.set(42, { __element_root: { type: 'view' } });

      // Mount first
      handleMount([10, 42, 'hash1', { color: 'red' }], 0, mockSnapshotValues);
      factory.mockClear();

      // Update
      const patch = [11, 42, { color: 'blue' }];
      const newIndex = handleUpdate(patch, 0, mockSnapshotValues);

      expect(newIndex).toBe(2);
      expect(factory).toHaveBeenCalledWith({ color: 'blue' });
      expect(instanceMap.get(42)!.props).toEqual({ color: 'blue' });
    });

    it('should warn when instance not found for update', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const patch = [11, 999, {}];
      handleUpdate(patch, 0, mockSnapshotValues);

      expect(warnSpy).toHaveBeenCalledWith(
        '[MTC] Instance not found for update, ID: 999',
      );
    });
  });

  describe('handleUnmount', () => {
    it('should cleanup an MTC instance on unmount', () => {
      const factory = vi.fn();
      registerMTCComponent('hash1', factory);
      mockSnapshotValues.set(42, { __element_root: { type: 'view' } });

      // Mount first
      handleMount([10, 42, 'hash1', {}], 0, mockSnapshotValues);
      expect(instanceMap.has(42)).toBe(true);

      // Unmount
      const patch = [12, 42];
      const newIndex = handleUnmount(patch, 0, mockSnapshotValues);

      expect(newIndex).toBe(1);
      expect(instanceMap.has(42)).toBe(false);
    });

    it('should be a no-op for non-existent instance', () => {
      const patch = [12, 999];
      const newIndex = handleUnmount(patch, 0, mockSnapshotValues);
      expect(newIndex).toBe(1);
    });
  });

  describe('cleanupAllInstances', () => {
    it('should clean up all instances', () => {
      const factory = vi.fn();
      registerMTCComponent('hash1', factory);
      mockSnapshotValues.set(1, { __element_root: {} });
      mockSnapshotValues.set(2, { __element_root: {} });

      handleMount([10, 1, 'hash1', {}], 0, mockSnapshotValues);
      handleMount([10, 2, 'hash1', {}], 0, mockSnapshotValues);

      expect(instanceMap.size).toBe(2);

      cleanupAllInstances();

      expect(instanceMap.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch errors in component factory and report them', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const factory = vi.fn(() => {
        throw new Error('render failed');
      });
      registerMTCComponent('hash1', factory);
      mockSnapshotValues.set(42, { __element_root: {} });

      // Should not throw
      handleMount([10, 42, 'hash1', {}], 0, mockSnapshotValues);

      expect(errorSpy).toHaveBeenCalledWith(
        '[MTC] Error in component hash1:',
        expect.any(Error),
      );
      expect(lynx.reportError).toHaveBeenCalled();
    });
  });
});
