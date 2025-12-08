/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Rpc, type RpcCallType } from '@lynx-js/web-worker-rpc';
import {
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
  disposeEndpoint,
  markTimingEndpoint,
  postTimingFlagsEndpoint,
  publicComponentEventEndpoint,
  publishEventEndpoint,
  sendGlobalEventEndpoint,
  dispatchI18nResourceEndpoint,
  updateDataEndpoint,
  updateGlobalPropsEndpoint,
} from '@client/endpoints.js';
import type { TimingEntry, WorkerStartMessage } from '@types';
import { LynxCrossThreadContext } from '@client/LynxCrossThreadContext.js';
import { systemInfo } from './LynxViewInstance.js';

function createWebWorker(): Worker {
  return new Worker(
    /* webpackFetchPriority: "high" */
    /* webpackChunkName: "web-core-worker-runtime" */
    /* webpackPrefetch: true */
    /* webpackPreload: true */
    new URL('../background/index.js', import.meta.url),
    {
      type: 'module',
      name: 'lynx-bg',
    },
  );
}
export class BackgroundThread implements AsyncDisposable {
  static contextIdToBackgroundWorker: ({
    worker: Worker;
    runningCards: number;
  } | undefined)[] = [];

  private rpc: Rpc;
  private webWorker?: Worker;
  private nextMacroTask: ReturnType<typeof setTimeout> | null = null;
  private catchedTimingInfo: TimingEntry[] = [];
  private batchSendTimingInfo: RpcCallType<typeof markTimingEndpoint>;

  readonly jsContext: LynxCrossThreadContext;

  readonly postTimingFlags: RpcCallType<typeof postTimingFlagsEndpoint>;
  readonly sendGlobalEvent: RpcCallType<typeof sendGlobalEventEndpoint>;
  readonly publicComponentEvent: RpcCallType<
    typeof publicComponentEventEndpoint
  >;
  readonly publishEvent: RpcCallType<typeof publishEventEndpoint>;
  readonly dispatchI18nResource: RpcCallType<
    typeof dispatchI18nResourceEndpoint
  >;
  readonly updateData: RpcCallType<typeof updateDataEndpoint>;
  readonly updateGlobalProps: RpcCallType<typeof updateGlobalPropsEndpoint>;

  constructor(private readonly lynxGroupId: number | undefined) {
    const btsRpc = new Rpc(undefined, 'ui-to-bg');
    this.rpc = btsRpc;
    this.jsContext = new LynxCrossThreadContext({
      rpc: this.rpc,
      receiveEventEndpoint: dispatchJSContextOnMainThreadEndpoint,
      sendEventEndpoint: dispatchCoreContextOnBackgroundEndpoint,
    });
    this.batchSendTimingInfo = this.rpc.createCall(markTimingEndpoint);
    this.postTimingFlags = this.rpc.createCall(postTimingFlagsEndpoint);
    this.sendGlobalEvent = this.rpc.createCall(sendGlobalEventEndpoint);
    this.publicComponentEvent = this.rpc.createCall(
      publicComponentEventEndpoint,
    );
    this.publishEvent = this.rpc.createCall(publishEventEndpoint);
    this.dispatchI18nResource = this.rpc.createCall(
      dispatchI18nResourceEndpoint,
    );
    this.updateData = this.rpc.createCall(updateDataEndpoint);
    this.updateGlobalProps = this.rpc.createCall(updateGlobalPropsEndpoint);
  }

  startWebWorker() {
    // now start the background worker
    if (this.lynxGroupId !== undefined) {
      const group =
        BackgroundThread.contextIdToBackgroundWorker[this.lynxGroupId];
      if (group) {
        group.runningCards += 1;
      } else {
        BackgroundThread.contextIdToBackgroundWorker[this.lynxGroupId] = {
          worker: createWebWorker(),
          runningCards: 1,
        };
      }
      this.webWorker = BackgroundThread.contextIdToBackgroundWorker[
        this.lynxGroupId
      ]!.worker;
    } else {
      this.webWorker = createWebWorker();
    }
    const messageChannel = new MessageChannel();
    this.webWorker.postMessage(
      {
        mainThreadMessagePort: messageChannel.port1,
        systemInfo,
      } as WorkerStartMessage,
      [messageChannel.port2],
    );
    this.rpc.setMessagePort(messageChannel.port1);
  }

  markTiming(
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ): void {
    this.catchedTimingInfo.push({
      timingKey,
      pipelineId,
      timeStamp: timeStamp ?? performance.now(),
    });
    if (this.nextMacroTask === null) {
      this.nextMacroTask = setTimeout(() => {
        this.flushTimingInfo();
      }, 500);
    }
  }

  /**
   * Flush the timing info immediately.
   */
  flushTimingInfo(): void {
    this.batchSendTimingInfo(this.catchedTimingInfo);
    this.catchedTimingInfo = [];
    this.nextMacroTask = null;
    this.nextMacroTask && clearTimeout(this.nextMacroTask);
  }

  [Symbol.asyncDispose](): Promise<void> {
    if (this.lynxGroupId !== undefined) {
      const group =
        BackgroundThread.contextIdToBackgroundWorker[this.lynxGroupId];
      if (group) {
        group.runningCards -= 1;
        if (group.runningCards === 0) {
          group.worker.terminate();
          BackgroundThread.contextIdToBackgroundWorker[
            this.lynxGroupId
          ] = undefined;
        }
      }
    } else {
      this.webWorker?.terminate();
    }
    this.nextMacroTask && clearTimeout(this.nextMacroTask);
    return this.rpc.invoke(disposeEndpoint, []);
  }
}
