// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';
import { ErrorCode } from '../../../constants.js';
import { invokeUIMethodEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';
import { __InvokeUIMethod } from '../elementAPIs/pureElementPAPIs.js';
export function registerInvokeUIMethodHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    invokeUIMethodEndpoint,
    (
      type,
      identifier,
      component_id,
      method,
      params,
      root_unique_id,
    ) => {
      let code = ErrorCode.UNKNOWN;
      let data: any = undefined;
      queryNodes(
        lynxViewInstance,
        type,
        identifier,
        component_id,
        true,
        root_unique_id,
        (element) => {
          __InvokeUIMethod(
            element as HTMLElement,
            method,
            params as object,
            (res) => {
              code = res.code;
              data = res.data;
            },
          );
        },
        (error) => {
          code = error;
        },
      );
      return { code, data };
    },
  );
}
