// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createProcessData } from '../../core/lynx-data-processors.js';
import { getPageLynx } from '../../core/page-lynx.js';
import type { DataProcessorDefinition } from '../../lynx-api.js';

export function setupLynxEnv(): void {
  if (!__LEPUS__) {
    const { initData, updateData } = getPageLynx().getApp()._params;
    getPageLynx().__initData = { ...initData, ...updateData };
    getPageLynx().registerDataProcessors = function() {};
  }

  if (__LEPUS__) {
    getPageLynx().__initData = {
      /* available only in renderPage */
    };
    // @ts-expect-error no type for lynx.SystemInfo
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    globalThis.SystemInfo = getPageLynx().SystemInfo ?? {};

    getPageLynx().reportError = function(e: Error | string) {
      const error = e instanceof Error ? e : new Error(JSON.stringify(e));
      _ReportError(error, {
        errorCode: 1101, // ErrCode::LYNX_ERROR_CODE_LEPUS in Lynx/base/debug/error_code.h
      });
    };

    getPageLynx().triggerGlobalEventFromLepus = function(
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

    getPageLynx().registerDataProcessors = function(
      dataProcessorDefinition?: DataProcessorDefinition,
    ) {
      globalThis.processData = createProcessData(dataProcessorDefinition);
    };

    // register empty DataProcessors to make sure `globalThis.processData` is set
    getPageLynx().registerDataProcessors();
  }
}
