/*
 * Copyright (C) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rpc, RpcCallType } from '@lynx-js/web-worker-rpc';
import {
  markTimingEndpoint,
  postTimingFlagsEndpoint,
  sendGlobalEventEndpoint,
} from '@client/endpoints.js';
import type { TimingEntry } from '@types';

export class BackgroundThread {
  private rpc: Rpc;

  private nextMacroTask: ReturnType<typeof setTimeout> | null = null;
  private catchedTimingInfo: TimingEntry[] = [];
  private batchSendTimingInfo: RpcCallType<typeof markTimingEndpoint>;

  postTimingFlags: RpcCallType<typeof postTimingFlagsEndpoint>;
  sendGlobalEvent: RpcCallType<typeof sendGlobalEventEndpoint>;

  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.batchSendTimingInfo = this.rpc.createCall(markTimingEndpoint);
    this.postTimingFlags = this.rpc.createCall(postTimingFlagsEndpoint);
    this.sendGlobalEvent = this.rpc.createCall(sendGlobalEventEndpoint);
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
}
