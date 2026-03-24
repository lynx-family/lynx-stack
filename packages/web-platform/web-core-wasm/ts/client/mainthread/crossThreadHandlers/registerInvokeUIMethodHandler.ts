// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';
import { ErrorCode } from '../../../constants.js';
import { invokeUIMethodEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

function createMethodAlias(
  lynxViewInstance: LynxViewInstance,
): Record<string, (element: Element, params: unknown) => unknown> {
  return {
    'boundingClientRect': (element) => {
      const rect = element.getBoundingClientRect();
      const containerRect = lynxViewInstance.rootDom.host
        .getBoundingClientRect();
      return {
        id: element.id,
        width: rect.width,
        height: rect.height,
        left: rect.left - containerRect.left,
        right: rect.right - containerRect.left,
        top: rect.top - containerRect.top,
        bottom: rect.bottom - containerRect.top,
      };
    },
  };
}

export function registerInvokeUIMethodHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  const methodAlias = createMethodAlias(lynxViewInstance);
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
          try {
            const aliasMethod = methodAlias[method];
            const hasDomMethod = typeof (element as any)[method] === 'function';
            if (!aliasMethod && !hasDomMethod) {
              code = ErrorCode.METHOD_NOT_FOUND;
            } else {
              if (aliasMethod) {
                data = aliasMethod(element, params);
              } else {
                data = (element as any)[method](params);
              }
              code = ErrorCode.SUCCESS;
            }
          } catch (e) {
            console.error(
              `[lynx-web] invokeUIMethod: apply method failed with`,
              e,
              element,
            );
            code = ErrorCode.PARAM_INVALID;
          }
        },
        (error) => {
          code = error;
        },
      );
      return { code, data };
    },
  );
}
