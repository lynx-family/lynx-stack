// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background Thread bootstrap entry.
 *
 * Injected by @lynx-js/vue-rsbuild-plugin as the first import of every
 * background bundle.  Sets up:
 *   - globalThis.publishEvent  – routes native events to Vue handlers
 *   - globalThis.renderPage    – triggers deferred Vue app mount
 *   - globalThis.updatePage    – placeholder (Vue reactivity handles updates)
 */

import { triggerRenderPage } from './app-registry.js'
import { publishEvent } from './event-registry.js'

const g = globalThis as Record<string, unknown>

// Make event dispatch available to the Lynx native layer.
g['publishEvent'] = publishEvent

// Lynx calls renderPage when it's ready to display the first frame.
g['renderPage'] = function (_data: unknown): void {
  triggerRenderPage()
}

// Lynx calls updatePage when page-level data changes from the host.
// Vue's reactivity system handles component-level updates automatically;
// user code can subscribe to this if needed via a custom global store.
g['updatePage'] = function (_data: unknown): void {
  // no-op for MVP
}
