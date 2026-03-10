// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { triggerComponentEventEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

export function registerTriggerComponentEventHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    triggerComponentEventEndpoint,
    (
      id,
      params,
    ) => {
      const componentDom = lynxViewInstance.mtsWasmBinding
        .getElementByComponentId(id);
      componentDom?.dispatchEvent(
        new CustomEvent(id, {
          ...params.eventOption,
          detail: params.eventDetail,
        }),
      );
    },
  );
}
