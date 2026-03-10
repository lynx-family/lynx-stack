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

import { elements } from './element-registry.js';
import { applyOps, resetMainThreadState } from './ops-apply.js';
import { runOnBackground } from './run-on-background-mt.js';

const g = globalThis as Record<string, unknown>;

// Expose SystemInfo on globalThis (the worklet-runtime reads it).
// In React's main-thread bundle this is done by the generated snapshot code.
g['SystemInfo'] = (typeof lynx !== 'undefined' && lynx.SystemInfo) ?? {};

// Register runOnBackground as a global — extracted LEPUS worklet code calls it
// as a bare identifier (the SWC transform generates `runOnBackground(_jsFnK)`).
g['runOnBackground'] = runOnBackground;

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

// Worklet registrations are included in this bundle via webpack's dependency
// graph — user code on the MT layer is processed by worklet-loader-mt which
// extracts registerWorkletInternal() calls per-entry.
