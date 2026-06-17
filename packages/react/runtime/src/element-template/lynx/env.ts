// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createProcessData } from '../../core/lynx-data-processors.js';
import type { DataProcessorDefinition } from '../../lynx-api.js';

export function setupLynxEnv(): void {
  if (!__LEPUS__) {
    let initData: Record<string, unknown> = {};
    let updateData: Record<string, unknown> = {};

    try {
      const params = (lynxCoreInject as {
        tt?: { _params?: { initData?: Record<string, unknown>; updateData?: Record<string, unknown> } };
      })
        ?.tt?._params;
      if (params) {
        initData = params.initData ?? {};
        updateData = params.updateData ?? {};
      }
    } catch {}

    lynx.__initData = { ...initData, ...updateData };
    lynx.registerDataProcessors = function() {};
  }

  if (__LEPUS__) {
    lynx.__initData = {
      /* available only in renderPage */
    };
    (globalThis as typeof globalThis & { SystemInfo?: unknown }).SystemInfo =
      (lynx as typeof lynx & { SystemInfo?: unknown }).SystemInfo ?? {};

    lynx.triggerGlobalEventFromLepus = function(
      eventName: string,
      params: any,
    ) {
      __OnLifecycleEvent(['globalEventFromLepus', [eventName, params]]);
    };

    {
      // eslint-disable-next-line unicorn/consistent-function-scoping
      function __name(empty: string) {
        return `Native${empty}Modules`;
      }
      // TODO(hongzhiyuan.hzy): make sure this is run before any other code (especially code access `NativeModules`)
      // @ts-expect-error hack
      if (typeof globalThis[__name('')] === 'undefined') {
        // @ts-expect-error hack
        globalThis[__name('')] = undefined;
      }
    }

    lynx.registerDataProcessors = function(
      dataProcessorDefinition?: DataProcessorDefinition,
    ) {
      globalThis.processData = createProcessData(dataProcessorDefinition);
    };

    lynx.registerDataProcessors();
  }
}
