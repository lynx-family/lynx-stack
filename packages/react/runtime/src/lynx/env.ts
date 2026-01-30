// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { profileEnd, profileStart } from '../debug/utils.js';
import type { DataProcessorDefinition, InitData, InitDataRaw } from '../lynx-api.js';

export function setupLynxEnv(): void {
  if (!__LEPUS__) {
    const { initData, updateData } = lynxCoreInject.tt._params;
    lynx.__initData = { ...initData, ...updateData };
    lynx.registerDataProcessors = function() {};
  }

  if (__LEPUS__) {
    lynx.__initData = {
      /* available only in renderPage */
    };
    // @ts-expect-error no type for lynx.SystemInfo
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    globalThis.SystemInfo = lynx.SystemInfo ?? {};

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
      let hasDefaultDataProcessorExecuted = false;
      globalThis.processData = (data, processorName) => {
        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileStart('processData');
        }

        let r: InitData | InitDataRaw;
        try {
          if (processorName) {
            r = dataProcessorDefinition?.dataProcessors?.[processorName]?.(data) as InitData ?? data;
          } else {
            r = dataProcessorDefinition?.defaultDataProcessor?.(data) ?? data;
          }
        } catch (e: any) {
          lynx.reportError(e as Error);
          // when there is an error
          // we should perform like dataProcessor returns nothing
          // so use `{}` rather than `data`
          r = {};
        }

        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileEnd();
        }

        if (hasDefaultDataProcessorExecuted === false) {
          // @ts-expect-error todo: add types to i18n logic
          if (globalThis.__I18N_RESOURCE_TRANSLATION__) {
            r = {
              ...r,
              // @ts-expect-error todo: add types to i18n logic
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              __I18N_RESOURCE_TRANSLATION__: globalThis.__I18N_RESOURCE_TRANSLATION__,
            };
          }

          // @ts-expect-error todo: add types to __EXTRACT_STR__
          if (__EXTRACT_STR__) {
            r = {
              ...r,
              // @ts-expect-error todo: add types to __EXTRACT_STR__
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              _EXTRACT_STR: __EXTRACT_STR_IDENT_FLAG__,
            };
          }
        }

        if (processorName) {}
        else {
          hasDefaultDataProcessorExecuted = true;
        }

        return r;
      };
    };

    // register empty DataProcessors to make sure `globalThis.processData` is set
    lynx.registerDataProcessors();
  }
}
