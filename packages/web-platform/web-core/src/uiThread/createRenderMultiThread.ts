// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  mainThreadStartEndpoint,
  updateDataEndpoint,
  updateI18nResourcesEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { registerReportErrorHandler } from './crossThreadHandlers/registerReportErrorHandler.js';
import { registerFlushElementTreeHandler } from './crossThreadHandlers/registerFlushElementTreeHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';
import { createExposureMonitorForMultiThread } from './crossThreadHandlers/createExposureMonitor.js';

export function createRenderMultiThread(
  mainThreadRpc: Rpc,
  shadowRoot: ShadowRoot,
  callbacks: {
    onError?: (err: Error, release: string, fileName: string) => void;
  },
) {
  registerReportErrorHandler(mainThreadRpc, 'lepus.js', callbacks.onError);
  registerFlushElementTreeHandler(mainThreadRpc, { shadowRoot });
  registerDispatchLynxViewEventHandler(mainThreadRpc, shadowRoot);
  createExposureMonitorForMultiThread(mainThreadRpc, shadowRoot);
  const start = mainThreadRpc.createCall(mainThreadStartEndpoint);
  const updateDataMainThread = mainThreadRpc.createCall(updateDataEndpoint);
  const updateI18nResourcesMainThread = mainThreadRpc.createCall(
    updateI18nResourcesEndpoint,
  );
  return {
    start,
    updateDataMainThread,
    updateI18nResourcesMainThread,
  };
}
