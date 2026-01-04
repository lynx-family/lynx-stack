// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { WorkerStartMessage } from '../../types/index.js';
import { startBackgroundThread } from './background-apis/startBackgroundThread.js';

// @ts-expect-error
globalThis.nativeConsole = console;

globalThis.onmessage = async (ev) => {
  const message = ev
    .data as WorkerStartMessage;
  if (!globalThis.SystemInfo) {
    globalThis.SystemInfo = message.systemInfo;
  }
  startBackgroundThread(message);
};
Object.assign(globalThis, {
  module: { exports: null },
});
