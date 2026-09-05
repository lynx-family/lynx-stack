import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackgroundElementTemplateInstance } from '../../../src/element-template/background/instance.js';
import { injectLepusMethods } from '../../../src/element-template/native/main-thread-api.js';
import { elementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';

interface FakeRef {
  uid: number;
}

type LepusMethods = typeof globalThis & {
  getUniqueIdListBySnapshotId: (args: { snapshotId: number }) => { uniqueIdList: number[] } | null;
  getSnapshotIdByUniqueId: (args: { uniqueId: number }) => { snapshotId: number } | null;
};

describe('injectLepusMethods', () => {
  beforeEach(() => {
    vi.stubGlobal('__GetElementUniqueID', (ref: FakeRef) => ref.uid);
    elementTemplateRegistry.set(-1, { uid: 101 } as unknown as ElementRef);
    elementTemplateRegistry.set(7, { uid: 707 } as unknown as ElementRef);
    injectLepusMethods();
  });

  afterEach(() => {
    elementTemplateRegistry.clear();
    vi.unstubAllGlobals();
  });

  it('maps a handle id to the unique id of its element', () => {
    const g = globalThis as LepusMethods;
    expect(g.getUniqueIdListBySnapshotId({ snapshotId: -1 })).toEqual({ uniqueIdList: [101] });
    expect(g.getUniqueIdListBySnapshotId({ snapshotId: 7 })).toEqual({ uniqueIdList: [707] });
  });

  it('returns null for an unknown or missing handle id', () => {
    const g = globalThis as LepusMethods;
    expect(g.getUniqueIdListBySnapshotId({ snapshotId: 42 })).toBeNull();
    expect(g.getUniqueIdListBySnapshotId({} as { snapshotId: number })).toBeNull();
  });

  it('maps a unique id back to its handle id', () => {
    const g = globalThis as LepusMethods;
    expect(g.getSnapshotIdByUniqueId({ uniqueId: 707 })).toEqual({ snapshotId: 7 });
    expect(g.getSnapshotIdByUniqueId({ uniqueId: 101 })).toEqual({ snapshotId: -1 });
    expect(g.getSnapshotIdByUniqueId({ uniqueId: 999 })).toBeNull();
  });

  it('exposes the instance id as __id for devtools', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.instanceId = 12;
    expect(instance.__id).toBe(12);
  });
});
