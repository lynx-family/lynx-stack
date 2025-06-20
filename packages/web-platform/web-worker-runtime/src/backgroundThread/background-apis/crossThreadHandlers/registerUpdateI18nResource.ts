// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  dispatchI18nResourceEndpoint,
  updateI18nResourceEndpoint,
  type NativeTTObject,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { I18nResource } from '@lynx-js/web-constants';

export function registerUpdateI18nResource(
  uiThreadRpc: Rpc,
  mainThreadRpc: Rpc,
  i18nResource: I18nResource,
  tt: NativeTTObject,
): void {
  // updateI18nResourceEndpoint from ui thread
  uiThreadRpc.registerHandler(updateI18nResourceEndpoint, (data) => {
    i18nResource.setData(data);
    tt.GlobalEventEmitter.emit('onI18nResourceReady', []);
  });
  // dispatchI18nResource from mts
  mainThreadRpc.registerHandler(dispatchI18nResourceEndpoint, (data) => {
    i18nResource.setData(data);
    tt.GlobalEventEmitter.emit('onI18nResourceReady', []);
  });
}
