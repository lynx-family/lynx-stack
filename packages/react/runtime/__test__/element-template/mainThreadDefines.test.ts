// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

// The entry only has to hand the runtime members to the generated definitions;
// booting the real Element Template runtime (which installs native listeners)
// is out of scope here.
vi.mock('@lynx-js/react/element-template/internal', () => ({
  __etAttrPlanMap: {},
  adaptEventAttrSlot: () => {},
  adaptMTEventAttrSlot: () => {},
  adaptRefAttrSlot: () => {},
  adaptSpreadAttrSlot: () => {},
  loadWorkletRuntime: () => true,
}));

// The members the assembled definitions call. Keep in sync with
// `ELEMENT_TEMPLATE_RUNTIME_MEMBERS` in `@lynx-js/react-webpack-plugin`.
const PROVIDED_MEMBERS = [
  '__etAttrPlanMap',
  'adaptEventAttrSlot',
  'adaptMTEventAttrSlot',
  'adaptRefAttrSlot',
  'adaptSpreadAttrSlot',
  'loadWorkletRuntime',
];

afterEach(() => {
  vi.resetModules();
  // @ts-expect-error injected by the bundler
  delete globalThis.__lynxMainThreadDefines;
  // @ts-expect-error injected by the bundler
  delete globalThis.__webpack_require__;
});

async function importMainThreadDefines() {
  await import('../../main-thread-defines/element-template.js');
}

describe('Element Template main-thread defines entry', () => {
  it('registers the definitions generated into the bundle', async () => {
    const defines = vi.fn();
    // @ts-expect-error injected by the bundler
    globalThis.__lynxMainThreadDefines = defines;

    await importMainThreadDefines();

    expect(defines).toHaveBeenCalledTimes(1);
    const [runtime, internalRuntime, loadWorkletRuntime, require] = defines.mock
      .calls[0]!;
    expect(internalRuntime).toBe(runtime);
    for (const member of PROVIDED_MEMBERS) {
      expect(runtime[member], member).toBeDefined();
    }
    expect(loadWorkletRuntime).toBeTypeOf('function');
    expect(require()).toBe(runtime);
  });

  it('publishes the runtime for lazy bundle sections', async () => {
    // @ts-expect-error injected by the bundler
    globalThis.__lynxMainThreadDefines = vi.fn();
    // @ts-expect-error injected by the bundler
    globalThis.__webpack_require__ = {};

    await importMainThreadDefines();

    // @ts-expect-error injected by the bundler
    expect(globalThis.__webpack_require__['mtDefinesRuntime'].__etAttrPlanMap)
      .toBeDefined();
  });

  it('does nothing when the bundle has no definitions', async () => {
    await expect(importMainThreadDefines()).resolves.not.toThrow();
  });
});
