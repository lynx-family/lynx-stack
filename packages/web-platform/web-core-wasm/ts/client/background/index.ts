// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { startBackgroundThread } from './background-apis/startBackgroundThread.js';

// @ts-expect-error
globalThis.nativeConsole = console;

export interface WorkerStartMessage {
  mode: 'main' | 'background';
  mainThreadMessagePort: MessagePort;
  systemInfo?: Record<string, any>;
}

globalThis.onmessage = async (ev) => {
  const { mode, mainThreadMessagePort, systemInfo } = ev
    .data as WorkerStartMessage;
  if (!globalThis.SystemInfo) {
    globalThis.SystemInfo = systemInfo;
  }
  startBackgroundThread(mainThreadMessagePort);
};
Object.assign(globalThis, {
  module: { exports: null },
});
