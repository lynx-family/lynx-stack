// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectLepusMethods } from '../../../src/element-template/native/main-thread-api.js';
import { __page } from '../../../src/element-template/runtime/page/page.js';
import { elementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';

interface FakeRef {
  uid: number;
}

type LepusMethods = typeof globalThis & {
  getUniqueIdListByElementTemplateHandleId: (args: { handleId: number }) => { uniqueIdList: number[] } | null;
};

describe('injectLepusMethods', () => {
  beforeEach(() => {
    vi.stubGlobal('__GetElementUniqueID', (ref: FakeRef | typeof __page) => ref === __page ? 1 : (ref as FakeRef).uid);
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
    expect(g.getUniqueIdListByElementTemplateHandleId({ handleId: -1 })).toEqual({ uniqueIdList: [101] });
    expect(g.getUniqueIdListByElementTemplateHandleId({ handleId: 7 })).toEqual({ uniqueIdList: [707] });
  });

  it('returns null for an unknown or missing handle id', () => {
    const g = globalThis as LepusMethods;
    expect(g.getUniqueIdListByElementTemplateHandleId({ handleId: 42 })).toBeNull();
    expect(g.getUniqueIdListByElementTemplateHandleId({} as { handleId: number })).toBeNull();
  });
});
