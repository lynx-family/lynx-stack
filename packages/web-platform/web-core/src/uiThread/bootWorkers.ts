// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Rpc } from '@lynx-js/web-worker-rpc';
import type { WorkerStartMessage } from '@lynx-js/web-worker-runtime';

interface LynxViewRpc {
  mainThreadRpc: Rpc;
  backgroundRpc: Rpc;
  terminateWorkers: () => void;
}

let preHeatedMainWorker = createMainWorker();

export function bootWorkers(): LynxViewRpc {
  const curMainWorker = preHeatedMainWorker;
  const curBackgroundWorker = createBackgroundWorker(
    curMainWorker.channelMainThreadWithBackground,
  );

  preHeatedMainWorker = createMainWorker();
  return {
    mainThreadRpc: curMainWorker.mainThreadRpc,
    backgroundRpc: curBackgroundWorker.backgroundRpc,
    terminateWorkers: () => {
      curMainWorker.mainThreadWorker.terminate();
      curBackgroundWorker.backgroundThreadWorker.terminate();
    },
  };
}

function createMainWorker() {
  const channelToMainThread = new MessageChannel();
  const channelMainThreadWithBackground = new MessageChannel();
  const mainThreadWorker = new Worker(
    new URL('@lynx-js/web-worker-runtime', import.meta.url),
    {
      type: 'module',
      name: `lynx-main`,
    },
  );
  const mainThreadMessage: WorkerStartMessage = {
    mode: 'main',
    toUIThread: channelToMainThread.port2,
    toPeerThread: channelMainThreadWithBackground.port1,
    pixelRatio: window.devicePixelRatio,
  };

  mainThreadWorker.postMessage(mainThreadMessage, [
    channelToMainThread.port2,
    channelMainThreadWithBackground.port1,
  ]);
  const mainThreadRpc = new Rpc(channelToMainThread.port1, 'ui-to-main');
  return {
    mainThreadRpc,
    mainThreadWorker,
    channelMainThreadWithBackground,
  };
}

function createBackgroundWorker(
  channelMainThreadWithBackground: MessageChannel,
) {
  const channelToBackground = new MessageChannel();
  const backgroundThreadWorker = new Worker(
    new URL('@lynx-js/web-worker-runtime', import.meta.url),
    {
      type: 'module',
      name: `lynx-bg`,
    },
  );
  const backgroundThreadMessage: WorkerStartMessage = {
    mode: 'background',
    toUIThread: channelToBackground.port2,
    toPeerThread: channelMainThreadWithBackground.port2,
    pixelRatio: window.devicePixelRatio,
  };
  backgroundThreadWorker.postMessage(backgroundThreadMessage, [
    channelToBackground.port2,
    channelMainThreadWithBackground.port2,
  ]);
  const backgroundRpc = new Rpc(channelToBackground.port1, 'ui-to-bg');
  return { backgroundRpc, backgroundThreadWorker };
}
