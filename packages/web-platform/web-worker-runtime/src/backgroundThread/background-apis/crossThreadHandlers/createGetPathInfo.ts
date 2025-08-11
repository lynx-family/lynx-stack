// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  ErrorCode,
  getPathInfoEndpoint,
  type NativeApp,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function createGetPathInfo(rpc: Rpc): NativeApp['getPathInfo'] {
  return (
    type,
    identifier,
    component_id,
    first_only,
    callback,
    root_unique_id,
  ) => {
    rpc.invoke(getPathInfoEndpoint, [
      type,
      identifier,
      component_id,
      first_only,
      root_unique_id,
    ]).then(callback).catch((error: Error) => {
      console.error(`[lynx-web] getPathInfo failed`, error);
      callback({
        code: ErrorCode.UNKNOWN,
        data: error.message || '',
      });
    });
  };
}
