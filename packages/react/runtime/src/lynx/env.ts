// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { DataProcessorDefinition } from '../lynx-api.js';

export function setupLynxEnv(): void {
  if (!__LEPUS__) {
    const { initData, updateData } = lynxCoreInject.tt._params;
    // @ts-ignore
    lynx.__initData = { ...initData, ...updateData };
    lynx.registerDataProcessors = function() {};
  }

  if (__LEPUS__) {
    // @ts-ignore
    lynx.__initData = {
      /* available only in renderPage */
    };
    // @ts-ignore
    globalThis.SystemInfo = lynx.SystemInfo || {};

    lynx.reportError = function(e: any) {
      _ReportError(e, {
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
      function __name(empty: string) {
        return `Native${empty}Modules`;
      }
      // TODO(hongzhiyuan.hzy): make sure this is run before any other code (especially code access `NativeModules`)
      // @ts-ignore
      if (typeof globalThis[__name('')] === 'undefined') {
        // @ts-ignore
        globalThis[__name('')] = undefined;
      }
    }

    lynx.registerDataProcessors = function(
      dataProcessorDefinition?: DataProcessorDefinition,
    ) {
      let hasDefaultDataProcessorExecuted = false;
      // @ts-ignore
      globalThis.processData = (data, processorName) => {
        if (__PROFILE__) {
          console.profile('processData');
        }

        let r;
        try {
          if (processorName) {
            r = dataProcessorDefinition?.dataProcessors?.[processorName]?.(data)
              ?? data;
          } else {
            r = dataProcessorDefinition?.defaultDataProcessor?.(data) ?? data;
          }
        } catch (e: any) {
          lynx.reportError(e);
          // when there is an error
          // we should perform like dataProcessor returns nothing
          // so use `{}` rather than `data`
          r = {};
        }

        if (__PROFILE__) {
          console.profileEnd();
        }

        if (hasDefaultDataProcessorExecuted === false) {
          // @ts-ignore
          if (globalThis.__I18N_RESOURCE_TRANSLATION__) {
            r = {
              ...r,
              // @ts-ignore
              __I18N_RESOURCE_TRANSLATION__: globalThis.__I18N_RESOURCE_TRANSLATION__,
            };
          }

          // @ts-ignore
          if (__EXTRACT_STR__) {
            r = {
              ...r,
              // @ts-ignore
              _EXTRACT_STR: __EXTRACT_STR_IDENT_FLAG__,
            };
          }
        }

        if (processorName) {}
        else {
          hasDefaultDataProcessorExecuted = true;
        }

        return r;
        // TODO
      };
    };

    // register empty DataProcessors to make sure `globalThis.processData` is set
    lynx.registerDataProcessors();
  }
}
