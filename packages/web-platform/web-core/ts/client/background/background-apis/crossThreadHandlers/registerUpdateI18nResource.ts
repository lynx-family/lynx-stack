// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { II18nResource, NativeTTObject } from '../../../../types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { dispatchI18nResourceEndpoint } from '../../../endpoints.js';

export function registerUpdateI18nResource(
  mainThreadRpc: Rpc,
  i18nResource: II18nResource,
  tt: NativeTTObject,
): void {
  // dispatchI18nResource from mts
  mainThreadRpc.registerHandler(dispatchI18nResourceEndpoint, (data) => {
    i18nResource.setData(data);
    tt.GlobalEventEmitter.emit('onI18nResourceReady', []);
  });
}
