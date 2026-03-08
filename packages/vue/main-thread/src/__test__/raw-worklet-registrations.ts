// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Raw worklet registrations for the mts-draggable-raw demo.
 *
 * These are hand-crafted registerWorkletInternal calls that simulate what the
 * SWC worklet transform (Phase 2) auto-generates from 'main thread' directive
 * annotations. They are kept here as a reference/test fixture; production code
 * should use the transform-based approach (see mts-draggable/).
 *
 * Each call stores a function body in lynxWorkletImpl._workletMap keyed by
 * _wkltId. When native fires the event, runWorklet() looks it up and executes
 * it on the Main Thread with zero thread crossings.
 *
 * Corresponding BG-thread worklet context objects live in:
 *   e2e-lynx/src/mts-draggable-raw/App.vue
 */

declare function registerWorkletInternal(
  type: string,
  id: string,
  fn: (this: Record<string, unknown>, ...args: unknown[]) => unknown,
): void;

// mts-draggable-raw: Scroll handler — moves element via setStyleProperty.
// Reads event.detail.scrollTop and translates the MT-ref element.
// Starts at y=500, moves up as scrollTop increases.
registerWorkletInternal(
  'main-thread',
  'mts-draggable-raw:onScroll',
  function(this: Record<string, unknown>, ...args: unknown[]) {
    const event = args[0] as Record<string, unknown>;
    const detail = (event as { detail?: { scrollTop?: number } }).detail;
    const scrollTop = detail?.scrollTop ?? 0;

    const DEFAULT_X = 0;
    const DEFAULT_Y = 500;
    const newX = DEFAULT_X;
    const newY = DEFAULT_Y - scrollTop;

    const c = this['_c'] as { _mtRef?: { _wvid?: number } } | undefined;
    if (!c?._mtRef?._wvid) return;

    const wvid = c._mtRef._wvid;
    const impl = (globalThis as Record<string, unknown>)['lynxWorkletImpl'] as {
      _refImpl?: {
        _workletRefMap?: Record<
          number,
          { current: { setStyleProperty?(k: string, v: string): void } | null }
        >;
      };
    } | undefined;

    const refEntry = impl?._refImpl?._workletRefMap?.[wvid];
    if (
      refEntry?.current
      && typeof refEntry.current.setStyleProperty === 'function'
    ) {
      refEntry.current.setStyleProperty(
        'transform',
        `translate(${newX}px, ${newY}px)`,
      );
    }
  },
);
