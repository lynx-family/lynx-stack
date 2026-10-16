// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, it, vi } from 'vitest';

import '../../src/worklet-runtime/global.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each(['before hydration', 'after hydration'])(
  'keeps the new page ref callable when old destruction observers run %s',
  async (releaseTiming) => {
    const observers: Array<() => void> = [];
    const listeners = new Map<string, (event: unknown) => void>();
    const setAttribute = vi.fn();
    // Native may collect an old BTS object long after its entry was replaced.
    // Retain its real destruction callback and deliver it to the current MTS.
    vi.stubGlobal('lynx', {
      getNativeApp: () => ({
        createJSObjectDestructionObserver: (callback: () => void) => {
          observers.push(callback);
          return {};
        },
      }),
      getCoreContext: () => ({
        dispatchEvent: (event: { type: string }) => listeners.get(event.type)?.(event),
      }),
      getJSContext: () => ({
        addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback),
      }),
    });
    vi.stubGlobal('SystemInfo', { lynxSdkVersion: '2.16' });
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('__SetAttribute', setAttribute);
    vi.stubGlobal('__FlushElementTree', vi.fn());
    vi.useFakeTimers();

    for (let generation = 0; generation < 3; generation++) {
      // Both thread entries are evaluated afresh, sharing only the native Lynx.
      vi.resetModules();
      const { MainThreadRef } = await import('../../src/core/main-thread-ref.js');
      const { takeMainThreadRefInitValuePatch } = await import('../../src/core/main-thread-ref-init-value.js');
      const { initWorklet } = await import('../../src/worklet-runtime/workletRuntime.js');
      const { initEventListeners } = await import('../../src/worklet-runtime/listeners.js');
      const { updateWorkletRefInitValueChanges } = await import('../../src/worklet-runtime/workletRef.js');
      vi.stubGlobal('__JS__', false);
      const firstScreenRef = new MainThreadRef(null);
      initWorklet();
      initEventListeners();
      globalThis.registerWorklet(
        'main-thread',
        'tap',
        function(this: { _c: { ref: { current: { setAttribute(name: string, value: string): void } } } }) {
          this._c.ref.current.setAttribute('test-state', 'tapped');
        },
      );
      const firstScreenTap = { _wkltId: 'tap', _c: { ref: firstScreenRef } };
      const element = { generation };
      globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({ ...firstScreenRef.toJSON(), _initValue: null }, element);
      globalThis.runWorklet(firstScreenTap, []);

      vi.stubGlobal('__JS__', true);
      const backgroundRef = new MainThreadRef(null);
      updateWorkletRefInitValueChanges(takeMainThreadRefInitValuePatch());
      const backgroundTap = { _wkltId: 'tap', _c: { ref: backgroundRef } };
      const releaseOldRefs = () => observers.slice(0, generation).forEach(release => release());
      if (releaseTiming === 'before hydration') releaseOldRefs();
      globalThis.lynxWorkletImpl._hydrateCtx(backgroundTap, firstScreenTap);
      if (releaseTiming === 'after hydration') releaseOldRefs();

      setAttribute.mockClear();
      // Exercise the same ref dereference and Element API as the demo tap.
      expect(() => globalThis.runWorklet(backgroundTap, [])).not.toThrow();
      expect(setAttribute).toHaveBeenCalledExactlyOnceWith(element, 'test-state', 'tapped');
      await vi.runAllTimersAsync();
    }
  },
);
