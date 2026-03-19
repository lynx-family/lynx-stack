// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { reloadEndpoint } from '@lynx-js/web-constants';

export function registerReloadHandler(
  rpc: Rpc,
  reloadHandler: () => void,
) {
  rpc.registerHandler(
    reloadEndpoint,
    reloadHandler,
  );
}
