// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerPatchHandler, patchHandlerRegistry } from '../../src/lifecycle/patch/patchHandlerRegistry.js';
import { snapshotPatchApply } from '../../src/lifecycle/patch/snapshotPatchApply.js';
import type { SnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch.js';

describe('patchHandlerRegistry', () => {
  afterEach(() => {
    patchHandlerRegistry.clear();
  });

  it('should register and invoke a custom patch handler', () => {
    const handler = vi.fn((_patch: SnapshotPatch, i: number) => {
      // consume 2 params after the opcode
      return i + 2;
    });

    registerPatchHandler(99, handler);

    const patch: SnapshotPatch = [99, 'arg1', 'arg2'];
    snapshotPatchApply(patch);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(patch, 0);
  });

  it('should return an unregister function that removes the handler', () => {
    const handler = vi.fn((_patch: SnapshotPatch, i: number) => i);
    const unregister = registerPatchHandler(99, handler);

    unregister();

    expect(patchHandlerRegistry.has(99)).toBe(false);

    // After unregister, applying the patch should warn in dev mode, not call handler
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    snapshotPatchApply([99]);
    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[ReactLynx] Unknown snapshot operation:',
      99,
    );
    warnSpy.mockRestore();
  });

  it('should support multiple handlers for different ops', () => {
    const handler1 = vi.fn((_patch: SnapshotPatch, i: number) => i + 1);
    const handler2 = vi.fn((_patch: SnapshotPatch, i: number) => i + 1);

    registerPatchHandler(50, handler1);
    registerPatchHandler(51, handler2);

    snapshotPatchApply([50, 'data1', 51, 'data2']);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should warn in dev mode for unknown operations', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    snapshotPatchApply([999]);

    expect(warnSpy).toHaveBeenCalledWith(
      '[ReactLynx] Unknown snapshot operation:',
      999,
    );
    warnSpy.mockRestore();
  });
});
