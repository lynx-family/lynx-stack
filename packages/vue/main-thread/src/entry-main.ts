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

import { applyOps, elements } from './ops-apply.js';

const g = globalThis as Record<string, unknown>;

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
  const page = __CreatePage('0', 0);
  elements.set(PAGE_ROOT_ID, page);
  __FlushElementTree(page);
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
