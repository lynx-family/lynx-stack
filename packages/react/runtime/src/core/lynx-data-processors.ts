// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { profileEnd, profileStart } from '../shared/profile.js';

/**
 * The interface you can extends so that the `defaultDataProcessor` parameter can be customized
 *
 * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
 *
 * @public
 *
 * @group Types
 */
export interface InitDataRaw {}
/**
 * The interface you can extends so that the `defaultDataProcessor` returning value can be customized
 *
 * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
 *
 * @public
 *
 * @group Types
 */
export interface InitData {}

/**
 * The data processors that registered with {@link Lynx.registerDataProcessors}.
 *
 * @example
 *
 * Extending `dataProcessors` interface
 *
 * ```ts
 * import type { DataProcessors as WellKnownDataProcessors } from '@lynx-js/react';
 *
 * declare module '@lynx-js/react' {
 *   interface DataProcessors extends WellKnownDataProcessors {
 *     foo(bar: string): number;
 *   }
 * }
 * ```
 *
 * Then you can use `lynx.registerDataProcessors` with types.
 *
 * ```js
 * lynx.registerDataProcessors({
 *   dataProcessors: {
 *     foo(bar) {
 *       return 1;
 *     }
 *   }
 * })
 * ```
 *
 * @public
 *
 * @group Types
 */
export interface DataProcessors {
  /**
   * Optional processor to override screen metrics used by the app
   *
   * @param metrics - The physical screen dimensions in pixels
   *
   * @returns New screen dimensions to be used by the app
   *
   * @example
   *
   * ```ts
   * lynx.registerDataProcessors({
   *   dataProcessors: {
   *     getScreenMetricsOverride: (metrics) => {
   *       // Force a specific aspect ratio
   *       return {
   *         width: metrics.width,
   *         height: metrics.width * (16/9)
   *       };
   *     }
   *   }
   * });
   * ```
   */
  getScreenMetricsOverride?(metrics: {
    /**
     * The physical pixel width of the screen
     */
    width: number;
    /**
     * The physical pixel height of the screen
     */
    height: number;
  }): { width: number; height: number };

  /**
   * Custom unknown data processors.
   *
   * @remarks
   *
   * You may extends the `DataProcessors` interface for better TypeScript types. See {@link DataProcessors}.
   */
  [processorName: string]: (...args: any[]) => any;
}

/**
 * Definition of DataProcessor(s)
 * @public
 *
 * @group Types
 */
export interface DataProcessorDefinition {
  /**
   * You can custom input and output type of `defaultDataProcessor` by extends {@link InitDataRaw} and {@link InitData}
   *
   * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
   *
   * @param rawInitData - initData passed from native code
   * @returns
   * @public
   */
  defaultDataProcessor?: (rawInitData: InitDataRaw) => InitData;
  /**
   * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
   *
   * @public
   */
  dataProcessors?: DataProcessors;
}

// `true` only while the default data processor is running. `defaultDataProcessor` is
// invoked by the native side as a separate call *before* `renderPage` / `updatePage`,
// so a `markFirstScreenSyncReady()` made inside it must not sync the *previous* tree
// (still latched ready) — a re-render of the data being processed is imminent. The
// first-screen sync backend reads this to defer such a mark. Lives here (not in the
// backend) so `core` does not depend on a runtime backend.
let processingDefaultData = false;

export function isProcessingDefaultData(): boolean {
  return processingDefaultData;
}

export function createProcessData(
  dataProcessorDefinition?: DataProcessorDefinition,
): (data: InitDataRaw, processorName?: string) => InitData | InitDataRaw {
  let hasDefaultDataProcessorExecuted = false;

  return (data, processorName) => {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileStart('processData');
    }

    let result: InitData | InitDataRaw;
    try {
      if (processorName) {
        result = dataProcessorDefinition?.dataProcessors?.[processorName]?.(data) as InitData ?? data;
      } else {
        // a `markFirstScreenSyncReady()` made inside `defaultDataProcessor` must be
        // deferred until the data being processed renders (see `processingDefaultData`)
        processingDefaultData = true;
        try {
          result = dataProcessorDefinition?.defaultDataProcessor?.(data) ?? data;
        } finally {
          processingDefaultData = false;
        }
      }
    } catch (error: unknown) {
      lynx.reportError(error as Error);
      result = {};
    }

    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }

    if (!hasDefaultDataProcessorExecuted) {
      result = appendInitDataMetadata(result);
    }

    if (!processorName) {
      hasDefaultDataProcessorExecuted = true;
    }

    return result;
  };
}

function appendInitDataMetadata(result: InitData | InitDataRaw): InitData | InitDataRaw {
  // @ts-expect-error todo: add types to i18n logic
  const i18nResourceTranslation: unknown = globalThis.__I18N_RESOURCE_TRANSLATION__;
  if (i18nResourceTranslation) {
    result = {
      ...result,
      __I18N_RESOURCE_TRANSLATION__: i18nResourceTranslation,
    };
  }

  // @ts-expect-error todo: add types to __EXTRACT_STR__
  if (__EXTRACT_STR__) {
    // @ts-expect-error todo: add types to __EXTRACT_STR__
    const extractStrIdentFlag: unknown = __EXTRACT_STR_IDENT_FLAG__;
    result = {
      ...result,
      _EXTRACT_STR: extractStrIdentFlag,
    };
  }

  return result;
}
