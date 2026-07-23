/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { describe, expect, it } from 'vitest';

import '../../src/mtsDefines';
import { __pageId, createSnapshot, snapshotCreatorMap } from '../../src/internal';

describe('mtsDefines', () => {
  it('should expose the runtime members used by the generated main-thread defines', () => {
    const runtime = globalThis.__lynxMainThreadRuntime;
    expect(runtime.createSnapshot).toBe(createSnapshot);
    expect(runtime.snapshotCreatorMap).toBe(snapshotCreatorMap);
    expect(runtime.__pageId).toBe(__pageId);
    expect(runtime.loadWorkletRuntime).toBeTypeOf('function');
    expect(runtime.updateEvent).toBeTypeOf('function');
    expect(runtime.updateWorkletEvent).toBeTypeOf('function');
    expect(runtime.transformRef).toBeTypeOf('function');
    expect(runtime.__DynamicPartSlotV2).toBeTypeOf('number');
    expect(runtime.__DynamicPartSlotV2_0).toBeDefined();
  });
});
