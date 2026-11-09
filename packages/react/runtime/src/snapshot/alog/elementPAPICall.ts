// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  formatDebugArgs,
  formatDebugValue,
  truncateDebugString,
  tryEndDebugProfile,
  tryStartDebugProfile,
} from '../../shared/debug-logging.js';

const fiberElementPAPINameList = [
  '__CreatePage',
  '__CreateElement',
  '__CreateWrapperElement',
  '__CreateText',
  '__CreateImage',
  '__CreateView',
  '__CreateRawText',
  '__CreateList',
  '__AppendElement',
  '__InsertElementBefore',
  '__RemoveElement',
  '__ReplaceElement',
  '__FirstElement',
  '__LastElement',
  '__NextElement',
  '__GetPageElement',
  '__GetTemplateParts',
  '__AddDataset',
  '__SetDataset',
  '__GetDataset',
  '__SetAttribute',
  '__GetAttributes',
  '__GetAttributeByName',
  '__GetAttributeNames',
  '__SetClasses',
  '__SetCSSId',
  '__AddInlineStyle',
  '__SetInlineStyles',
  '__AddEvent',
  '__SetID',
  '__GetElementUniqueID',
  '__GetTag',
  '__FlushElementTree',
  '__UpdateListCallbacks',
  '__OnLifecycleEvent',
  '__QueryComponent',
  '__SetGestureDetector',
  '__RemoveGestureDetector',
];

export function initElementPAPICallAlog(globalWithIndex: Record<string, unknown> = globalThis): void {
  let count = 0;
  const fiberElementMap = new Map<unknown, string>();
  const getTag = globalWithIndex['__GetTag'] as ((element: unknown) => string) | undefined;
  const getUniqueId = globalWithIndex['__GetElementUniqueID'] as ((element: unknown) => number) | undefined;

  const format = (value: unknown, previewStrings: boolean) =>
    fiberElementMap.get(value) ?? formatDebugValue(value, previewStrings);

  for (const name of fiberElementPAPINameList) {
    const native = globalWithIndex[name];
    if (typeof native !== 'function') {
      continue;
    }
    const callNative = native as (...args: unknown[]) => unknown;
    globalWithIndex[name] = (...args: unknown[]): unknown => {
      const shouldProfile = typeof __PROFILE__ !== 'undefined' && __PROFILE__;
      const started = shouldProfile && tryStartDebugProfile(`FiberElementPAPI: ${name}`, () => ({
        args: formatDebugArgs(args, value => format(value, false)),
      }));
      let result: unknown;
      try {
        result = callNative(...args);
      } finally {
        tryEndDebugProfile(started);
      }

      try {
        if (!shouldProfile && !console.alog) {
          return result;
        }
        if (name.startsWith('__Create') && result != null && getTag && getUniqueId) {
          fiberElementMap.set(result, `${truncateDebugString(getTag(result))}#${getUniqueId(result)}`);
        }
        console.alog?.(
          `[ReactLynxDebug] FiberElement API call #${++count}: ${name}(${
            formatDebugArgs(args, value => format(value, true))
          })${result == null ? '' : ` => ${format(result, true)}`}`,
        );
      } catch {
        // Handle lookup and logging are diagnostic only.
      }
      return result;
    };
  }
}
