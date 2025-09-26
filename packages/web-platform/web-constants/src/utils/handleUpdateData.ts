// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MainThreadGlobalThis } from '../types/MainThreadGlobalThis.js';
import type { Cloneable } from '../types/Cloneable.js';
import type { UpdateDataOptions } from '../types/UpdateDataOptions.js';
import { updateDataEndpoint } from '../endpoints.js';
import type { RpcCallType } from '@lynx-js/web-worker-rpc';

export function handleUpdatedData(
  newData: Cloneable,
  options: UpdateDataOptions | undefined,
  runtime: MainThreadGlobalThis,
  updateDataBackground: RpcCallType<typeof updateDataEndpoint>,
) {
  handleUpdatedData;
  const processedData = runtime.processData?.(
    newData,
    options?.processorName,
  );
  runtime.updatePage?.(processedData, options);
  return updateDataBackground(processedData, options);
}
