// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RpcCallType } from '@lynx-js/web-worker-rpc';
import type { LynxView } from '../../apis/createLynxView.js';
import { updateDataEndpoint, type Cloneable } from '@lynx-js/web-constants';

export function createUpdateData(
  updateDataMainThread: RpcCallType<typeof updateDataEndpoint>,
): LynxView['updateData'] {
  return (
    data: Cloneable,
    processorName?: string,
    callback?: () => void,
  ) => {
    updateDataMainThread(data, { processorName }).then(() => callback?.());
  };
}
