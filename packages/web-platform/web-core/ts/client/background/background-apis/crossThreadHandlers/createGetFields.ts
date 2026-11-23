// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import type { NativeApp } from '../../../../types/index.js';
import { getFieldsEndpoint } from '../../../endpoints.js';
import { ErrorCode } from '../../../../constants.js';

export function createGetFields(rpc: Rpc): NativeApp['getFields'] {
  return (
    type,
    identifier,
    component_id,
    first_only,
    fields,
    callback,
    root_unique_id,
  ) => {
    rpc.invoke(getFieldsEndpoint, [
      type,
      identifier,
      component_id,
      first_only,
      fields,
      root_unique_id,
    ]).then(callback, (error: unknown) => {
      callback({
        data: first_only ? null : [],
        status: {
          code: ErrorCode.UNKNOWN,
          data: error instanceof Error ? error.message : 'getFields failed',
        },
      });
    });
  };
}
