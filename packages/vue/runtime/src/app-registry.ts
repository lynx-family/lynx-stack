// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Defers Vue app.mount() until Lynx's renderPage lifecycle fires.
 *
 * The user calls app.mount() at module evaluation time.  We store the mount
 * function and call it when Lynx calls globalThis.renderPage().  If
 * renderPage already fired (e.g., page reload) we mount immediately.
 */

type MountFn = () => void

const pendingMounts: MountFn[] = []
let renderPageCalled = false

export function registerMount(fn: MountFn): void {
  if (renderPageCalled) {
    fn()
  } else {
    pendingMounts.push(fn)
  }
}

export function triggerRenderPage(): void {
  renderPageCalled = true
  for (const fn of pendingMounts) {
    fn()
  }
  pendingMounts.length = 0
}
