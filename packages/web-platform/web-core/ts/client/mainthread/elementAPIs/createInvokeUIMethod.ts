// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ErrorCode } from '../../../constants.js';
import type { InvokeUIMethodPAPI } from '../../../types/index.js';
import type { BoundingClientRectService } from '../BoundingClientRectService.js';

export function createInvokeUIMethod(
  boundingClientRectService: BoundingClientRectService,
): InvokeUIMethodPAPI {
  return (element, method, params, callback) => {
    let code = ErrorCode.UNKNOWN;
    let data: any = undefined;
    try {
      if (method === 'boundingClientRect') {
        const rect = element.getBoundingClientRect();
        const lynxViewRect = boundingClientRectService.getLynxViewRect();
        data = {
          id: element.id,
          left: rect.left - lynxViewRect.left,
          right: rect.right - lynxViewRect.left,
          top: rect.top - lynxViewRect.top,
          bottom: rect.bottom - lynxViewRect.top,
          width: rect.width,
          height: rect.height,
        };
        code = ErrorCode.SUCCESS;
      } else if (typeof (element as any)[method] === 'function') {
        data = (element as any)[method](params);
        code = ErrorCode.SUCCESS;
      } else {
        code = ErrorCode.METHOD_NOT_FOUND;
      }
    } catch (e) {
      console.error(
        `[lynx-web] invokeUIMethod: apply method failed with`,
        e,
        element,
      );
      code = ErrorCode.PARAM_INVALID;
    }
    callback({ code, data });
  };
}
