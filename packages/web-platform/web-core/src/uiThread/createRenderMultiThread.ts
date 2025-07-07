// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  loadTemplate,
  mainThreadStartEndpoint,
  queryComponentTemplateEndpoint,
  updateDataEndpoint,
  updateI18nResourcesEndpoint,
  type LynxTemplate,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { registerReportErrorHandler } from './crossThreadHandlers/registerReportErrorHandler.js';
import { registerFlushElementTreeHandler } from './crossThreadHandlers/registerFlushElementTreeHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';
import { createExposureMonitorForMultiThread } from './crossThreadHandlers/createExposureMonitor.js';
import type { StartUIThreadCallbacks } from './startUIThread.js';
import { registerQueryComponent } from './crossThreadHandlers/registerQueryComponent.js';

export function createRenderMultiThread(
  mainThreadRpc: Rpc,
  backgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  callbacks: StartUIThreadCallbacks,
) {
  registerReportErrorHandler(mainThreadRpc, 'lepus.js', callbacks.onError);
  registerFlushElementTreeHandler(mainThreadRpc, { shadowRoot });
  registerDispatchLynxViewEventHandler(mainThreadRpc, shadowRoot);
  const triggerMtsQueryComponentTemplate = mainThreadRpc.createCall(
    queryComponentTemplateEndpoint,
  );
  const triggerBtsQueryComponentTemplate = backgroundRpc.createCall(
    queryComponentTemplateEndpoint,
  );
  // Indicates whether the template has been executed
  const templateEntries: Record<string, boolean> = {};
  const triggerQueryComponentTemplate = (
    { source, template }: { source: string; template?: LynxTemplate },
  ) => {
    if (!template) return;
    if (templateEntries[source]) return;
    templateEntries[source] = true;
    triggerMtsQueryComponentTemplate(source, template);
    triggerBtsQueryComponentTemplate(source, template);
  };
  registerQueryComponent(
    {
      mainThreadRpc,
      backgroundRpc,
      getTemplate: (source: string) =>
        loadTemplate(source, true, callbacks.customTemplateLoader),
      triggerQueryComponentTemplate,
    },
  );
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
