// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { startBackgroundThread } from './backgroundThread/index.js';
import { startMainThread } from './mainThread/startMainThread.js';

export interface WorkerStartMessage {
  mode: 'main' | 'background';
  toPeerThread: MessagePort;
  toUIThread: MessagePort;
}

globalThis.onmessage = (ev) => {
  const { mode, toPeerThread, toUIThread } = ev
    .data as WorkerStartMessage;
  if (mode === 'main') {
    startMainThread(toUIThread, toPeerThread);
  } else {
    startBackgroundThread(toUIThread, toPeerThread);
  }
};
Object.assign(globalThis, {
  module: { exports: null },
});

export { startMainThread };
