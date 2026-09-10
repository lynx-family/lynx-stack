// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Forwards a main-thread callback to the background thread.
 *
 * `updateCardData`, `onAppReload` and `updateGlobalProps` reach the main
 * thread only; the engine has no background-bound event for them. The main
 * thread therefore relays them over its own proxy to the background thread,
 * where `registerAppEventHandlers` subscribes.
 */
export function sendToBackground(type: string, data: unknown[]): void {
  // A runtime attached to no card of its own has no background thread to reach.
  lynx.getJSContext?.().dispatchEvent({ type, data });
}
