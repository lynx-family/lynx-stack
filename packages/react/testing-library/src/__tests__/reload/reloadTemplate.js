// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';

import { __root } from '../../../../runtime/lib/root.js';
import { flushDelayedLifecycleEvents } from '../../../../runtime/lib/snapshot/lynx/tt.js';

// What native does for `reloadTemplate`: the main thread re-renders and
// hydrates, then the background reloads and hydrates against the main
// thread's first-screen tree.
export function reloadTemplate(ui, data) {
  lynxTestingEnv.switchToMainThread();
  const lifecycleEvents = [];
  const original = globalThis.__OnLifecycleEvent;
  globalThis.__OnLifecycleEvent = (...args) => lifecycleEvents.push(args);
  try {
    globalThis.updatePage(data, { reloadTemplate: true });
  } finally {
    globalThis.__OnLifecycleEvent = original;
  }
  // The reload swaps in a fresh root; the environment reinstalls
  // `globalThis.__root` on every thread switch.
  globalThis.__root = __root;
  lynxTestingEnv.mainThread.globalThis.__root = __root;

  lynxTestingEnv.switchToBackgroundThread();
  __root.__jsx = ui;
  act(() => {
    lynx.getApp().onAppReload(data);
  });
  act(() => {
    for (const args of lifecycleEvents) {
      lynx.getApp().OnLifecycleEvent(...args);
    }
  });
  flushDelayedLifecycleEvents();
}
