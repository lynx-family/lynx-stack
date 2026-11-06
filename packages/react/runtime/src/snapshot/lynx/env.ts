// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { bindPage } from '@lynx-js/lynx-runtime/bts';
import { getGlobalProps, getSystemInfo, setDataProcessor } from '@lynx-js/lynx-runtime/mts';

import { createProcessData } from '../../core/lynx-data-processors.js';
import type { DataProcessorDefinition } from '../../lynx-api.js';

export function setupLynxEnv(): void {
  if (!__LEPUS__) {
    // RL owns its mutable state; the host's initial snapshot stays isolated.
    const page = bindPage();
    lynx.__initData = { ...page.getInitData() };
    lynx.__globalProps = { ...page.getGlobalProps() };
    lynx.registerDataProcessors = function() {};
  }

  if (__LEPUS__) {
    lynx.__initData = {
      /* available only in renderPage */
    };
    lynx.__globalProps = { ...getGlobalProps() };
    (globalThis as typeof globalThis & { SystemInfo?: unknown }).SystemInfo = getSystemInfo();

    lynx.reportError = function(e: Error | string) {
      const error = e instanceof Error ? e : new Error(JSON.stringify(e));
      _ReportError(error, {
        errorCode: 1101, // ErrCode::LYNX_ERROR_CODE_LEPUS in Lynx/base/debug/error_code.h
      });
    };

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
      setDataProcessor(createProcessData(dataProcessorDefinition));
    };

    // Install the default DSL processor before Native delivers its first input.
    lynx.registerDataProcessors();
  }
}
