/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rpc, RpcCallType } from '@lynx-js/web-worker-rpc';
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
import type { TimingEntry } from '@types';
import { LynxCrossThreadContext } from '@client/LynxCrossThreadContext.js';

export class BackgroundThread implements AsyncDisposable {
  private rpc: Rpc;

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

  constructor(rpc: Rpc) {
    this.rpc = rpc;
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
    this.nextMacroTask && clearTimeout(this.nextMacroTask);
    return this.rpc.invoke(disposeEndpoint, []);
  }
}
