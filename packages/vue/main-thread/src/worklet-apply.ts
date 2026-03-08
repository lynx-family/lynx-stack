// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Worklet / MainThreadRef ops for the Main Thread executor.
 *
 * Handles SET_WORKLET_EVENT, SET_MT_REF, and INIT_MT_REF operations.
 */

import { elements } from './element-registry.js';

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

interface WorkletRefImpl {
  _workletRefMap?: Record<number, { current: unknown; _wvid: number }>;
  updateWorkletRef(ref: unknown, el: LynxElement): void;
}

interface LynxWorkletImpl {
  _refImpl?: WorkletRefImpl;
}

/** Access globalThis.lynxWorkletImpl._refImpl, encapsulating the null check chain */
function getWorkletImpl(): LynxWorkletImpl | undefined {
  if (
    typeof globalThis !== 'undefined'
    && 'lynxWorkletImpl' in (globalThis as Record<string, unknown>)
  ) {
    return (globalThis as Record<string, unknown>)[
      'lynxWorkletImpl'
    ] as LynxWorkletImpl;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API (called from ops-apply.ts switch cases)
// ---------------------------------------------------------------------------

/** SET_WORKLET_EVENT: bind a worklet event handler to a native element */
export function applySetWorkletEvent(
  id: number,
  eventType: string,
  eventName: string,
  ctx: Record<string, unknown>,
): void {
  const el = elements.get(id);
  console.info(
    '[vue-mt] SET_WORKLET_EVENT id=',
    id,
    'type=',
    eventType,
    'name=',
    eventName,
    'ctx=',
    ctx,
    'el found=',
    el != null,
  );
  if (el) {
    // Native Lynx requires _workletType on the value to route the event
    // to runWorklet() instead of publishEvent(). React sets this in
    // workletEvent.ts:53 — we stamp it here on the MT side.
    ctx['_workletType'] = 'main-thread';
    __AddEvent(el, eventType, eventName, {
      type: 'worklet',
      value: ctx,
    });
  }
}

/** SET_MT_REF: bind a MainThreadRef to a native element via worklet-runtime */
export function applySetMtRef(id: number, refImpl: unknown): void {
  const el = elements.get(id);
  console.info(
    '[vue-mt] SET_MT_REF id=',
    id,
    'refImpl=',
    refImpl,
    'el found=',
    el != null,
  );
  // Store in workletRefMap so worklet-runtime can resolve _wvid -> element.
  // The worklet-runtime's updateWorkletRef expects the ref to already exist
  // in _workletRefMap (populated during React's hydration step). For Vue,
  // we pre-register the ref before calling updateWorkletRef.
  if (el) {
    const impl = getWorkletImpl();
    if (impl?._refImpl) {
      const ref = refImpl as { _wvid?: number; _initValue?: unknown };
      if (ref._wvid != null) {
        const refMap = impl._refImpl._workletRefMap;
        if (refMap && !(ref._wvid in refMap)) {
          refMap[ref._wvid] = {
            current: ref._initValue ?? null,
            _wvid: ref._wvid,
          };
        }
        impl._refImpl.updateWorkletRef(refImpl, el);
      }
    }
  }
}

/** INIT_MT_REF: register a value-only MainThreadRef in the worklet ref map */
export function applyInitMtRef(wvid: number, initValue: unknown): void {
  // Value-only refs (e.g. useMainThreadRef<number>(0)) are NOT bound to
  // elements, so they never go through SET_MT_REF. Without this, worklet
  // functions that access them get undefined from _workletRefMap lookup.
  const impl = getWorkletImpl();
  if (impl?._refImpl) {
    const refMap = impl._refImpl._workletRefMap;
    if (refMap && !(wvid in refMap)) {
      refMap[wvid] = { current: initValue, _wvid: wvid };
    }
  }
}

/** Reset worklet state — for testing only. */
// biome-ignore lint/suspicious/noEmptyBlockStatements: no module-level state to clear yet
export function resetWorkletState(): void {}
