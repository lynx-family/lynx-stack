// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  updateGlobalPropsEndpoint,
  type NativeTTObject,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerUpdateGlobalPropsHandler(
  rpc: Rpc,
  tt: NativeTTObject,
): void {
  rpc.registerHandlerLazy(
    updateGlobalPropsEndpoint,
    tt,
    'updateGlobalProps',
  );
}
