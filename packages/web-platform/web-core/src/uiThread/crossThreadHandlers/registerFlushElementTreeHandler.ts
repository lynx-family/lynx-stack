// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  flushElementTreeEndpoint,
  postOffscreenEventEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { initOffscreenDocument } from '@lynx-js/offscreen-document/main';

export function registerFlushElementTreeHandler(
  mainThreadRpc: Rpc,
  options: {
    shadowRoot: ShadowRoot;
  },
  onCommit: (info: {
    pipelineId: string | undefined;
    timingFlags: string[];
    isFP: boolean;
  }) => void,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
) {
  const {
    shadowRoot,
  } = options;
  const onEvent = mainThreadRpc.createCall(postOffscreenEventEndpoint);
  const { decodeOperation } = initOffscreenDocument({
    shadowRoot,
    onEvent,
  });
  let isFP = true;
  mainThreadRpc.registerHandler(
    flushElementTreeEndpoint,
    (operations, options, timingFlags) => {
      const { pipelineOptions } = options;
      const pipelineId = pipelineOptions?.pipelineID;
      markTimingInternal('dispatch_start', pipelineId);
      markTimingInternal('layout_start', pipelineId);
      markTimingInternal('ui_operation_flush_start', pipelineId);
      decodeOperation(operations);
      markTimingInternal('ui_operation_flush_end', pipelineId);
      markTimingInternal('layout_end', pipelineId);
      markTimingInternal('dispatch_end', pipelineId);
      onCommit({
        pipelineId,
        timingFlags,
        isFP,
      });
      if (isFP) {
        isFP = false;
      }
    },
  );
}
