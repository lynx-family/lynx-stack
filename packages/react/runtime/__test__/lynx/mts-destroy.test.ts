import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerDestroyMts } from '../../src/lynx/mts-destroy.js';
import { __root } from '../../src/root.js';
import { SnapshotInstance } from '../../src/snapshot.js';
import { globalEnvManager } from '../utils/envManager.js';

describe('mts destroy', () => {
  let originalGetNative: unknown;
  let originalSystemInfo: unknown;

  beforeEach(() => {
    globalEnvManager.resetEnv();
    originalGetNative = (lynx as any).getNative;
    originalSystemInfo = (globalThis as any).SystemInfo;
  });

  afterEach(() => {
    (lynx as any).getNative = originalGetNative;
    (globalThis as any).SystemInfo = originalSystemInfo;
    vi.restoreAllMocks();
  });

  it('does nothing when sdk version is not supported', () => {
    (globalThis as any).SystemInfo = { lynxSdkVersion: '3.3' };
    const addEventListener = vi.fn();
    (lynx as any).getNative = () => ({ addEventListener });

    registerDestroyMts();
    expect(addEventListener).not.toBeCalled();
  });

  it('removes root children on __DestroyLifetime', () => {
    (globalThis as any).SystemInfo = { lynxSdkVersion: '3.4' };
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    (lynx as any).getNative = () => ({ addEventListener, removeEventListener });

    const root = __root as unknown as SnapshotInstance;
    const child = new SnapshotInstance('wrapper');
    root.insertBefore(child);
    expect(root.childNodes.length).toBe(1);

    registerDestroyMts();
    expect(addEventListener).toBeCalledTimes(1);

    const cb = addEventListener.mock.calls[0]![1] as () => void;
    cb();
    expect(root.childNodes.length).toBe(0);
    expect(lynx.performance.profileStart).toBeCalledWith('ReactLynx::destroyMts');
    expect(lynx.performance.profileEnd).toBeCalled();
    expect(removeEventListener).toBeCalledWith('__DestroyLifetime', cb);
  });
});
