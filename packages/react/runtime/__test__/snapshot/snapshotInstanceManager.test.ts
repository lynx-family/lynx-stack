// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, it, vi } from 'vitest';

const nextIdKey = Symbol.for('__LYNX_SNAPSHOT_NEXT_ID__');

afterEach(() => {
  Reflect.deleteProperty(lynx, nextIdKey);
  vi.resetModules();
});

it('keeps snapshot IDs distinct when the main-thread runtime is re-evaluated', async () => {
  Reflect.deleteProperty(lynx, nextIdKey);
  vi.resetModules();
  const { snapshotInstanceManager: oldManager } = await import(
    '../../src/snapshot/snapshot/snapshotInstanceManager.js'
  );
  const oldId = --oldManager.nextId;
  --oldManager.nextId;
  oldManager.clear();

  vi.resetModules();
  const { snapshotInstanceManager: newManager } = await import(
    '../../src/snapshot/snapshot/snapshotInstanceManager.js'
  );
  expect(newManager).not.toBe(oldManager);
  expect(newManager.nextId).toBe(-2);
  const newId = --newManager.nextId;
  expect(newId).toBe(-3);
  expect(newId).not.toBe(oldId);
  expect(oldManager.nextId).toBe(newManager.nextId);
});
