// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Main Thread (Lepus) bootstrap entry.
 *
 * Injected by @lynx-js/vue-rsbuild-plugin as the sole content of the
 * main-thread bundle.  Sets up:
 *   - globalThis.processData   – required by Lynx Lepus runtime (data processor)
 *   - globalThis.renderPage    – creates the Lynx page root (id=1)
 *   - globalThis.updatePage    – no-op stub (required by Lynx Lepus runtime)
 *   - globalThis.vuePatchUpdate – receives ops from Background Thread
 */

import { applyOps, elements, resetMainThreadState } from './ops-apply.js';

const g = globalThis as Record<string, unknown>;

// Expose SystemInfo on globalThis (the worklet-runtime reads it).
// In React's main-thread bundle this is done by the generated snapshot code.
declare const lynx: Record<string, unknown>;
g['SystemInfo'] = (typeof lynx !== 'undefined' && lynx['SystemInfo']) ?? {};

// Load the worklet-runtime Lepus chunk which provides:
//   globalThis.runWorklet, globalThis.registerWorkletInternal,
//   globalThis.lynxWorkletImpl (with Element class, Animation, etc.)
// Native Lynx requires this chunk to be loaded via __LoadLepusChunk so it
// knows to call runWorklet() when a worklet event fires.
declare function __LoadLepusChunk(
  name: string,
  options: Record<string, unknown>,
): boolean;
declare const globDynamicComponentEntry: string | undefined;

if (typeof __LoadLepusChunk === 'undefined') {
  console.warn(
    '[vue-mt] __LoadLepusChunk not available, worklet events will not work',
  );
} else {
  const chunkOpts: Record<string, unknown> = { chunkType: 0 };
  if (typeof globDynamicComponentEntry !== 'undefined') {
    chunkOpts['dynamicComponentEntry'] = globDynamicComponentEntry;
  }
  __LoadLepusChunk('worklet-runtime', chunkOpts);
  console.info('[vue-mt] worklet-runtime chunk loaded');
}

/** PAGE_ROOT_ID must match the value in runtime/src/shadow-element.ts */
const PAGE_ROOT_ID = 1;

// Lynx Lepus runtime requires globalThis.processData to be set.
// It is called to transform initial data before renderPage runs.
// For Vue we have no data processors, so just pass data through.
g['processData'] = function(data: unknown, _processorName?: string): unknown {
  return data ?? {};
};

// Lynx calls renderPage on the Main Thread first (before Background JS runs).
// We create the root page element and store it as id=1 so Background ops that
// target the root can resolve it correctly.
g['renderPage'] = function(_data: unknown): void {
  console.info('[vue-mt] renderPage called');
  // Clear all element state from the previous page. This is essential for:
  // 1. Testing: prevents duplicate batch detection from skipping ops
  //    when ShadowElement IDs restart from 2 between test renders.
  // 2. Hot reload: ensures stale element handles don't persist.
  resetMainThreadState();
  const page = __CreatePage('0', 0);
  elements.set(PAGE_ROOT_ID, page);
  __FlushElementTree(page);
  console.info('[vue-mt] renderPage done, page root id=1 stored');
};

// Lynx may call updatePage / updateGlobalProps after data changes.
// We have no data binding on Main Thread, so these are no-ops.
g['updatePage'] = function(_data: unknown): void {
  // no-op: Vue Main Thread has no direct data binding
};

g['updateGlobalProps'] = function(_data: unknown): void {
  // no-op
};

// Called by the BG Thread via callLepusMethod('vuePatchUpdate', { data }).
g['vuePatchUpdate'] = function({ data }: { data: string }): void {
  const ops = JSON.parse(data) as unknown[];
  applyOps(ops);
};

// ---------------------------------------------------------------------------
// Hand-crafted worklet registrations for *-raw demo entries.
//
// The non-raw demos (mts-demo, mts-draggable) use the SWC worklet transform
// which auto-generates registerWorkletInternal calls from 'main thread'
// directive annotations. The *-raw demos use hand-crafted worklet context
// objects and require matching registrations here.
//
// Each registerWorkletInternal call stores a function body in
// lynxWorkletImpl._workletMap keyed by _wkltId. When native fires the
// event, runWorklet() looks it up and executes it.
// ---------------------------------------------------------------------------
declare function registerWorkletInternal(
  type: string,
  id: string,
  fn: (this: Record<string, unknown>, ...args: unknown[]) => unknown,
): void;

// mts-demo-raw: Scroll handler — moves element to track scroll position
registerWorkletInternal(
  'main-thread',
  'mts-demo-raw:onScroll',
  function(this: Record<string, unknown>, ...args: unknown[]) {
    const event = args[0] as Record<string, unknown>;
    const detail = (event as { detail?: { scrollTop?: number } }).detail;
    const scrollTop = detail?.scrollTop ?? 0;

    const INITIAL_Y = 400;
    const newY = INITIAL_Y - scrollTop;

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
      refEntry.current.setStyleProperty('transform', `translateY(${newY}px)`);
    }
  },
);

// mts-draggable-raw: Scroll handler — moves element via setStyleProperty
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

// gallery: MTS scrollbar — updates thumb position/height on scroll
registerWorkletInternal(
  'main-thread',
  'gallery:adjustScrollbarMTS',
  function(this: Record<string, unknown>, ...args: unknown[]) {
    const event = args[0] as Record<string, unknown>;
    const detail = (event as {
      detail?: { scrollTop?: number; scrollHeight?: number };
    }).detail;
    const scrollTop = detail?.scrollTop ?? 0;
    const scrollHeight = detail?.scrollHeight ?? 1;

    const sysInfo = (globalThis as Record<string, unknown>)['SystemInfo'] as
      | { pixelHeight?: number; pixelRatio?: number }
      | undefined;
    const listHeight =
      (sysInfo?.pixelHeight ?? 600) / (sysInfo?.pixelRatio ?? 1) - 48;

    const scrollbarHeight = listHeight * (listHeight / scrollHeight);
    const scrollbarTop = listHeight * (scrollTop / scrollHeight);

    const c = this['_c'] as { _thumbRef?: { _wvid?: number } } | undefined;
    if (!c?._thumbRef?._wvid) return;

    const wvid = c._thumbRef._wvid;
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
      refEntry.current.setStyleProperty('height', `${scrollbarHeight}px`);
      refEntry.current.setStyleProperty('top', `${scrollbarTop}px`);
    }
  },
);

// gallery: ScrollbarCompare MTS — no -48 offset (full screen height)
registerWorkletInternal(
  'main-thread',
  'gallery:adjustScrollbarCompare',
  function(this: Record<string, unknown>, ...args: unknown[]) {
    const event = args[0] as Record<string, unknown>;
    const detail = (event as {
      detail?: { scrollTop?: number; scrollHeight?: number };
    }).detail;
    const scrollTop = detail?.scrollTop ?? 0;
    const scrollHeight = detail?.scrollHeight ?? 1;

    const sysInfo = (globalThis as Record<string, unknown>)['SystemInfo'] as
      | { pixelHeight?: number; pixelRatio?: number }
      | undefined;
    const listHeight = (sysInfo?.pixelHeight ?? 600)
      / (sysInfo?.pixelRatio ?? 1);

    const scrollbarHeight = listHeight * (listHeight / scrollHeight);
    const scrollbarTop = listHeight * (scrollTop / scrollHeight);

    const c = this['_c'] as { _thumbRef?: { _wvid?: number } } | undefined;
    if (!c?._thumbRef?._wvid) return;

    const wvid = c._thumbRef._wvid;
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
      refEntry.current.setStyleProperty('height', `${scrollbarHeight}px`);
      refEntry.current.setStyleProperty('top', `${scrollbarTop}px`);
    }
  },
);
