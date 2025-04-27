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

const backgroundWorkerContextCount: number[] = [];
const contextIdToBackgroundWorker: (Worker | undefined)[] = [];

let preHeatedMainWorker = createMainWorker();
export function bootWorkers(
  lynxGroupId: number | undefined,
  allOnUI?: boolean,
): LynxViewRpc {
  let curMainWorker: {
    mainThreadRpc: Rpc;
    mainThreadWorker?: Worker;
    channelMainThreadWithBackground: MessageChannel;
  };
  if (allOnUI) {
    curMainWorker = createUIChannel();
  } else {
    curMainWorker = preHeatedMainWorker;
    preHeatedMainWorker = createMainWorker();
  }
  const curBackgroundWorker = createBackgroundWorker(
    lynxGroupId,
    curMainWorker.channelMainThreadWithBackground,
  );
  if (lynxGroupId !== undefined) {
    if (backgroundWorkerContextCount[lynxGroupId]) {
      backgroundWorkerContextCount[lynxGroupId]++;
    } else {
      backgroundWorkerContextCount[lynxGroupId] = 1;
    }
  }
  return {
    mainThreadRpc: curMainWorker.mainThreadRpc,
    backgroundRpc: curBackgroundWorker.backgroundRpc,
    terminateWorkers: () => {
      curMainWorker.mainThreadWorker?.terminate();
      if (lynxGroupId === undefined) {
        curBackgroundWorker.backgroundThreadWorker.terminate();
      } else if (backgroundWorkerContextCount[lynxGroupId] === 1) {
        curBackgroundWorker.backgroundThreadWorker.terminate();
        backgroundWorkerContextCount[lynxGroupId] = 0;
        contextIdToBackgroundWorker[lynxGroupId] = undefined;
      }
    },
  };
}

function createUIChannel() {
  const channelMainThreadWithBackground = new MessageChannel();
  const mainThreadRpc = new Rpc(
    channelMainThreadWithBackground.port1,
    'main-to-bg',
  );
  return {
    mainThreadRpc,
    channelMainThreadWithBackground,
  };
}

function createMainWorker() {
  const channelToMainThread = new MessageChannel();
  const channelMainThreadWithBackground = new MessageChannel();
  const mainThreadWorker = createWebWorker('lynx-main');
  const mainThreadMessage: WorkerStartMessage = {
    mode: 'main',
    toUIThread: channelToMainThread.port2,
    toPeerThread: channelMainThreadWithBackground.port1,
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
  lynxGroupId: number | undefined,
  channelMainThreadWithBackground: MessageChannel,
) {
  const channelToBackground = new MessageChannel();
  let backgroundThreadWorker: Worker;
  if (lynxGroupId) {
    backgroundThreadWorker = contextIdToBackgroundWorker[lynxGroupId]
      ?? createWebWorker('lynx-bg');
    contextIdToBackgroundWorker[lynxGroupId] = backgroundThreadWorker;
  } else {
    backgroundThreadWorker = createWebWorker('lynx-bg');
  }
  const backgroundThreadMessage: WorkerStartMessage = {
    mode: 'background',
    toUIThread: channelToBackground.port2,
    toPeerThread: channelMainThreadWithBackground.port2,
  };
  backgroundThreadWorker.postMessage(backgroundThreadMessage, [
    channelToBackground.port2,
    channelMainThreadWithBackground.port2,
  ]);
  const backgroundRpc = new Rpc(channelToBackground.port1, 'ui-to-bg');
  return { backgroundRpc, backgroundThreadWorker };
}

function createWebWorker(name: string): Worker {
  return new Worker(
    new URL('@lynx-js/web-worker-runtime', import.meta.url),
    {
      type: 'module',
      name,
    },
  );
}
