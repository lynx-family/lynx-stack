// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  updateDataEndpoint,
  type MainThreadGlobalThis,
  handleUpdatedData,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerUpdateDataHandler(
  mainThreadRpc: Rpc,
  backgroundThreadRpc: Rpc,
  runtime: MainThreadGlobalThis,
): void {
  const updateDataBackground = backgroundThreadRpc.createCall(
    updateDataEndpoint,
  );

  mainThreadRpc.registerHandler(
    updateDataEndpoint,
    (newData, options) =>
      handleUpdatedData(newData, options, runtime, updateDataBackground),
  );
}
