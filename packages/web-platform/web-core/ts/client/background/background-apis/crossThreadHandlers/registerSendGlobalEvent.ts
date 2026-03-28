// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeTTObject } from '../../../../types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { sendGlobalEventEndpoint } from '../../../endpoints.js';

export function registerSendGlobalEventHandler(
  rpc: Rpc,
  tt: NativeTTObject,
): void {
  rpc.registerHandler(sendGlobalEventEndpoint, (...args) => {
    tt.GlobalEventEmitter.emit(...args);
  });
}
