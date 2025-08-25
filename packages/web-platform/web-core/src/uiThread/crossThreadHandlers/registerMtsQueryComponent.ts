// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  mtsQueryComponentEndpoint,
  type LynxTemplate,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerMtsQueryComponent(
  mainThreadRpc: Rpc,
  callback: (source: string) => Promise<LynxTemplate>,
) {
  mainThreadRpc.registerHandler(
    mtsQueryComponentEndpoint,
    (source: string) => callback(source),
  );
}
