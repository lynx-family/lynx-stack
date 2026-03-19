// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NativeApp } from '../../../../types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { disposeEndpoint } from '../../../endpoints.js';

export function registerDisposeHandler(
  rpc: Rpc,
  nativeApp: NativeApp,
  destroyCard: typeof import('@lynx-js/lynx-core/web')['destroyCard'],
  callDestroyLifetimeFun:
    typeof import('@lynx-js/lynx-core/web')['callDestroyLifetimeFun'],
): void {
  rpc.registerHandler(disposeEndpoint, () => {
    const id = nativeApp.id;
    callDestroyLifetimeFun(id);
    destroyCard(id);
  });
}
