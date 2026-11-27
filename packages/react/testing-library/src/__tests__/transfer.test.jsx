// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { root, runOnBackground, runOnMainThread, useEffect, useMainThreadRef, useState } from '@lynx-js/react';
import { __root, transformToWorklet } from '@lynx-js/react/internal';
import { registerWorklet } from '@lynx-js/react/worklet-runtime/init';

import { fireEvent, waitSchedule } from '../pure.jsx';

function createEventChannel() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type);
      if (!list) return;
      listeners.set(type, list.filter(item => item !== listener));
    },
    emit(type, data) {
      const list = listeners.get(type);
      if (!list) return;
      for (const listener of [...list]) {
        listener({ type, data });
      }
    },
  };
}

function createDualThreadTransferHarness() {
  const mtsNative = createEventChannel();
  const btsNative = createEventChannel();
  const engine = createEventChannel();

  const heldFirstFrames = new Map();
  const heldIds = new Set();
  let failHydrateTransferId = null;

  const mtsLynx = lynxTestingEnv.mainThread.globalThis.lynx;
  const btsLynx = lynxTestingEnv.backgroundThread.globalThis.lynx;
  const realJsCtx = mtsLynx.getJSContext();
  const realCoreCtx = btsLynx.getCoreContext();

  const prevMts = {
    getJSContext: mtsLynx.getJSContext,
    getNative: mtsLynx.getNative,
    getEngine: mtsLynx.getEngine,
    reportError: mtsLynx.reportError,
  };
  const prevBts = {
    getCoreContext: btsLynx.getCoreContext,
    getNative: btsLynx.getNative,
    reportError: btsLynx.reportError,
  };

  const mtsErrors = [];
  const btsErrors = [];
  const originalJsDispatch = realJsCtx.dispatchEvent.bind(realJsCtx);
  const originalCoreDispatch = realCoreCtx.dispatchEvent.bind(realCoreCtx);

  realJsCtx.dispatchEvent = (event) => {
    if (event.type === '__TransferFirstFrame' && typeof event.data === 'string') {
      const packet = JSON.parse(event.data);
      if (heldIds.has(packet.transferId)) {
        heldFirstFrames.set(packet.transferId, event);
        return;
      }
    }
    originalJsDispatch(event);
  };

  realCoreCtx.dispatchEvent = (event) => {
    let nextEvent = event;
    if (event.type === '__TransferCommit' && typeof event.data === 'string') {
      const packet = JSON.parse(event.data);
      if (packet.kind === 'hydrate' && packet.transferId === failHydrateTransferId) {
        packet.patchList.patchList[0].snapshotPatch.push(0, '__snapshot_missing_consumer_test', 999999);
        nextEvent = { ...event, data: JSON.stringify(packet) };
      }
    }
    originalCoreDispatch(nextEvent);
  };

  mtsLynx.getNative = () => mtsNative;
  mtsLynx.getEngine = () => engine;
  mtsLynx.reportError = err => mtsErrors.push(err);

  btsLynx.getNative = () => btsNative;
  btsLynx.reportError = err => btsErrors.push(err);

  return {
    mtsErrors,
    btsErrors,
    holdFirstFrame(transferId) {
      heldIds.add(transferId);
    },
    releaseFirstFrame(transferId) {
      heldIds.delete(transferId);
      const event = heldFirstFrames.get(transferId);
      if (event !== undefined) {
        heldFirstFrames.delete(transferId);
        lynxTestingEnv.switchToBackgroundThread();
        originalJsDispatch(event);
      }
    },
    corruptNextHydration(transferId) {
      failHydrateTransferId = transferId;
    },
    renderPage(initData = {}) {
      lynxTestingEnv.switchToMainThread();
      engine.emit('__RenderPage', [initData]);
    },
    create(transferId, componentName, initialProps = {}) {
      lynxTestingEnv.switchToMainThread();
      mtsNative.emit('__CreateTransfer', { transferId, componentName, initialProps });
    },
    update(transferId, props) {
      lynxTestingEnv.switchToMainThread();
      mtsNative.emit('__UpdateTransfer', { transferId, props });
    },
    reload(transferId, props) {
      lynxTestingEnv.switchToMainThread();
      mtsNative.emit('__ReloadTransfer', { transferId, props });
    },
    destroy(transferId) {
      lynxTestingEnv.switchToMainThread();
      mtsNative.emit('__DestroyTransfer', { transferId });
    },
    destroyLifetime() {
      // Tear down in LIFO order relative to initialize() (MTS then BTS) because
      // testing-library runs both threads in one module graph and shares `root.js`.
      lynxTestingEnv.switchToBackgroundThread();
      btsNative.emit('__DestroyLifetime', {});
      lynxTestingEnv.switchToMainThread();
      mtsNative.emit('__DestroyLifetime', {});
    },
    restore() {
      realJsCtx.dispatchEvent = originalJsDispatch;
      realCoreCtx.dispatchEvent = originalCoreDispatch;
      Object.assign(mtsLynx, prevMts);
      Object.assign(btsLynx, prevBts);
    },
  };
}

describe('experimental transfer consumer (built runtime)', () => {
  it('interleaves real MTS/BTS hydration, worklets, refs, update, reload, and failure isolation', async () => {
    const harness = createDualThreadTransferHarness();
    const bgCalls = [];
    const mtEffectResults = [];
    globalThis.__seenMtsRefValues = [];
    const tapWorkletId = 'transfer-consumer-tap-worklet';

    // Register a main-thread worklet using the production first-screen `_isFirstScreen`
    // handle shape on MTS and `transformToWorklet` on BTS (testing-library compiles
    // JSX in MIXED mode, which does not emit `_isFirstScreen` placeholders).
    registerWorklet('main-thread', tapWorkletId, function() {
      this._c.mtCounter.current += 1;
      globalThis.__seenMtsRefValues.push(`${this._c.name}:${this._c.mtCounter.current}`);
      void runOnBackground(this._jsFn.recordOnBg)(this._c.name, this._c.mtCounter.current);
    });

    function Bubble(props) {
      const [taps, setTaps] = useState(0);
      const mtCounter = useMainThreadRef(0);

      useEffect(() => {
        void runOnMainThread((name) => {
          'main thread';
          return `hydrated:${name}`;
        })(props.name).then(res => {
          mtEffectResults.push(res);
        });
      }, [props.name]);

      function recordOnBg(name, value) {
        bgCalls.push(`${name}:${value}`);
        setTaps(count => count + 1);
      }

      const handleMainTap = {
        _wkltId: tapWorkletId,
        _c: {
          mtCounter,
          name: props.name,
        },
        _jsFn: {
          recordOnBg: __MAIN_THREAD__ ? { _isFirstScreen: true } : transformToWorklet(recordOnBg),
        },
      };

      return (
        <view main-thread:bindtap={handleMainTap}>
          <text>{`${props.name}:${props.label}:${taps}`}</text>
        </view>
      );
    }

    // Load the built package export on MTS and a second instance of the built module on BTS
    // so both sides share the real built runtime singletons (snapshot managers, worklet runtime).
    lynxTestingEnv.switchToMainThread();
    const { TransferRegistry: MtsTransfer } = await import('@lynx-js/react/experimental/transfer');
    MtsTransfer.registerComponent('Bubble', () => Bubble);

    lynxTestingEnv.switchToBackgroundThread();
    const { TransferRegistry: BtsTransfer } = await import(
      '../../../runtime/lib/snapshot/experimental/transfer.js?bts'
    );
    BtsTransfer.registerComponent('Bubble', () => Bubble);

    try {
      // `root.render` is ignored while transfer mode is active.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      lynxTestingEnv.switchToBackgroundThread();
      root.render(<view />);
      expect(__root.__jsx).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('`root.render` is ignored on transfer pages'));
      warn.mockRestore();

      harness.renderPage();

      const flushBg = async () => {
        lynxTestingEnv.switchToBackgroundThread();
        await waitSchedule();
      };
      const tapOnMain = (element) => {
        lynxTestingEnv.switchToMainThread();
        fireEvent.tap(element);
      };

      // Hold both first frames, then fire real main-thread taps before either instance hydrates.
      harness.holdFirstFrame('a');
      harness.holdFirstFrame('b');
      harness.create('a', 'Bubble', { name: 'A', label: 'v0' });
      harness.create('b', 'Bubble', { name: 'B', label: 'v0' });
      // Flush pre-hydration background effects so `runOnMainThread` queues via `setMainThreadWorkletScheduler`.
      await flushBg();
      expect(mtEffectResults).toEqual([]);

      const getTransferView = (id) =>
        Array.from(lynxTestingEnv.mainThread.elementTree.root.children).find(
          child => child.getAttribute('transfer-id') === id,
        );
      const getText = (id) => getTransferView(id).textContent;

      const viewA = getTransferView('a').firstChild;
      const viewB = getTransferView('b').firstChild;

      // Both instances execute real first-screen worklets (mutating MainThreadRef and queueing runOnBackground).
      tapOnMain(viewA);
      tapOnMain(viewB);
      expect(globalThis.__seenMtsRefValues).toEqual(['A:1', 'B:1']);
      expect(bgCalls).toEqual([]);

      // Hydrate A first via real BTS hydrate() -> SnapshotPatch -> MTS updateMainThread.
      harness.releaseFirstFrame('a');
      await flushBg();
      expect(harness.mtsErrors).toEqual([]);
      expect(harness.btsErrors).toEqual([]);
      expect(bgCalls).toEqual(['A:1']);
      expect(mtEffectResults).toEqual(['hydrated:A']);

      // B is still waiting on first screen: tap B again while A is live.
      tapOnMain(viewB);
      expect(globalThis.__seenMtsRefValues).toEqual(['A:1', 'B:1', 'B:2']);
      expect(bgCalls).toEqual(['A:1']);

      // Update A in place: preserves local `taps` state (`1`) while updating label.
      harness.update('a', { name: 'A', label: 'v1' });
      await flushBg();
      expect(getText('a')).toBe('A:v1:1');

      // Reload A: resets local `taps` state back to `0` while B remains untouched.
      harness.holdFirstFrame('a');
      harness.reload('a', { name: 'A', label: 'reloaded' });
      await flushBg();
      harness.releaseFirstFrame('a');
      await flushBg();
      expect(getText('a')).toBe('A:reloaded:0');

      // Now hydrate B: both pre-hydration runOnBackground calls run AND B's first-screen MainThreadRef
      // kept its value (`2`) across A's hydration and reload.
      harness.releaseFirstFrame('b');
      await flushBg();
      expect(bgCalls).toEqual(['A:1', 'B:1', 'B:2']);
      expect(getText('b')).toBe('B:v0:2');

      // Post-hydration tap on B continues from MainThreadRef value `2` -> `3`.
      tapOnMain(getTransferView('b').firstChild);
      await flushBg();
      expect(globalThis.__seenMtsRefValues).toEqual(['A:1', 'B:1', 'B:2', 'B:3']);
      expect(bgCalls).toEqual(['A:1', 'B:1', 'B:2', 'B:3']);

      // Failure isolation: C fails hydration mid-patch after queueing a first-screen call while D waits.
      harness.holdFirstFrame('c');
      harness.holdFirstFrame('d');
      harness.create('c', 'Bubble', { name: 'C', label: 'v0' });
      harness.create('d', 'Bubble', { name: 'D', label: 'v0' });
      await flushBg();
      tapOnMain(getTransferView('c').firstChild);
      tapOnMain(getTransferView('d').firstChild);
      harness.corruptNextHydration('c');
      harness.releaseFirstFrame('c');
      await flushBg();
      expect(harness.mtsErrors.length).toBeGreaterThan(0);
      expect(getTransferView('c')).toBeUndefined();

      // D still hydrates cleanly and only D's runOnBackground call fires (C's call was discarded).
      harness.corruptNextHydration(null);
      harness.releaseFirstFrame('d');
      await flushBg();
      expect(bgCalls).toEqual(['A:1', 'B:1', 'B:2', 'B:3', 'D:1']);
      expect(getText('d')).toBe('D:v0:1');

      // Tear down lifetime and verify `root.render` guard is restored.
      expect(mtEffectResults).toEqual(['hydrated:A', 'hydrated:A', 'hydrated:B', 'hydrated:D']);
      harness.destroyLifetime();
      lynxTestingEnv.switchToBackgroundThread();
      root.render(<view />);
      expect(__root.__jsx).toBeDefined();
    } finally {
      delete globalThis.__seenMtsRefValues;
      delete globalThis.lynxWorkletImpl?._workletMap?.[tapWorkletId];
      harness.destroyLifetime();
      lynxTestingEnv.switchToBackgroundThread();
      __root.__jsx = undefined;
      harness.restore();
    }
  });
});
