// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Hand-crafted worklet registrations for gallery e2e demos.
 *
 * These are DEV-ONLY: the rspeedy plugin appends this file's built output to
 * the main-thread bundle only in development mode, so production bundles pay
 * zero cost.
 *
 * The gallery demos use raw worklet context objects (no SWC transform) and
 * need matching registerWorkletInternal calls here. Each call stores a
 * function in lynxWorkletImpl._workletMap keyed by _wkltId. When native fires
 * the event, runWorklet() looks it up and executes it on the Main Thread.
 *
 * Production apps should use the SWC worklet transform ('main thread'
 * directive) which auto-generates these calls.
 */

declare function registerWorkletInternal(
  type: string,
  id: string,
  fn: (this: Record<string, unknown>, ...args: unknown[]) => unknown,
): void;

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
