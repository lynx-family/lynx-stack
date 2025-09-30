// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  MainThreadGlobalThis,
  Cloneable,
  UpdateDataOptions,
  RpcCallType,
  updateDataEndpoint,
} from '@lynx-js/web-constants';

export function handleUpdatedData(
  newData: Cloneable,
  options: UpdateDataOptions | undefined,
  runtime: MainThreadGlobalThis,
  updateDataBackground: RpcCallType<typeof updateDataEndpoint>,
) {
  const processedData = runtime.processData
    ? runtime.processData(newData, options?.processorName)
    : newData;
  runtime.updatePage?.(processedData, options);
  return updateDataBackground(processedData, options);
}
