// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { startBackgroundThread } from './backgroundThread/index.js';

export interface WorkerStartMessage {
  mode: 'main' | 'background';
  toPeerThread: MessagePort;
  toUIThread: MessagePort;
  systemInfo?: Record<string, any>;
}

globalThis.onmessage = async (ev) => {
  const { mode, toPeerThread, toUIThread, systemInfo } = ev
    .data as WorkerStartMessage;
  if (!globalThis.SystemInfo) {
    globalThis.SystemInfo = systemInfo;
  }
  if (mode === 'main') {
    const { startMainThreadWorker } = await import(
      /* webpackChunkName: "web-worker-runtime-main-thread" */
      /* webpackMode: "lazy-once" */
      /* webpackPreload: true */
      './mainThread/startMainThread.js'
    );
    startMainThreadWorker(toUIThread, toPeerThread);
  } else {
    startBackgroundThread(toUIThread, toPeerThread);
  }
};
Object.assign(globalThis, {
  module: { exports: null },
});
