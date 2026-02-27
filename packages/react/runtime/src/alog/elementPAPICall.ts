// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { profileEnd, profileStart } from '../debug/utils.js';

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
];

export function initElementPAPICallAlog(globalWithIndex: Record<string, unknown> = globalThis): void {
  let count = 0;
  const fiberElementMap = new Map<any, {
    tag: string;
    uniqueId: number;
  }>();
  function formatFiberElement(fiberElement: FiberElement): string {
    const fiberElementInfo = fiberElementMap.get(fiberElement)!;
    return `${fiberElementInfo.tag}#${fiberElementInfo.uniqueId}`;
  }
  const filteredFiberElementPAPINameList = fiberElementPAPINameList.filter(fiberElementPAPIName =>
    typeof globalWithIndex[fiberElementPAPIName] === 'function'
  );
  const originalFiberElementPAPIs = filteredFiberElementPAPINameList.reduce((prev, fiberElementPAPIName) => ({
    ...prev,
    [fiberElementPAPIName]: globalWithIndex[fiberElementPAPIName] as (...args: unknown[]) => unknown,
  }), {} as Record<string, (...args: unknown[]) => unknown>);

  filteredFiberElementPAPINameList.forEach(fiberElementPAPIName => {
    const oldFiberElementPAPI = globalWithIndex[fiberElementPAPIName];
    if (typeof oldFiberElementPAPI === 'function') {
      globalWithIndex[fiberElementPAPIName] = (...args: unknown[]): unknown => {
        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileStart(`FiberElementPAPI: ${fiberElementPAPIName}`, {
            args: {
              args: JSON.stringify(args),
            },
          });
        }
        const result = (oldFiberElementPAPI as (...args: unknown[]) => unknown)(...args);
        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileEnd();
        }

        const formattedArgs = [...args];

        for (let i = 0; i < formattedArgs.length; i++) {
          const arg = formattedArgs[i];
          if (Array.isArray(arg)) {
            formattedArgs[i] = '[' + arg.map((item: unknown) => {
              if (fiberElementMap.has(item)) {
                return formatFiberElement(item as FiberElement);
              }
              return JSON.stringify(item);
            }).join(', ') + ']';
          } else if (fiberElementMap.has(arg)) {
            formattedArgs[i] = formatFiberElement(arg as FiberElement);
          } else {
            formattedArgs[i] = JSON.stringify(arg);
          }
        }

        if (
          fiberElementPAPIName === '__CreatePage'
          || fiberElementPAPIName === '__CreateElement'
          || fiberElementPAPIName === '__CreateWrapperElement'
          || fiberElementPAPIName === '__CreateText'
          || fiberElementPAPIName === '__CreateImage'
          || fiberElementPAPIName === '__CreateView'
          || fiberElementPAPIName === '__CreateRawText'
          || fiberElementPAPIName === '__CreateList'
        ) {
          fiberElementMap.set(result as FiberElement, {
            tag: originalFiberElementPAPIs['__GetTag']!(result as FiberElement) as string,
            uniqueId: originalFiberElementPAPIs['__GetElementUniqueID']!(result as FiberElement) as number,
          });
        }

        let formattedResult;
        if (fiberElementMap.has(result)) {
          formattedResult = formatFiberElement(result as FiberElement);
        } else if (result !== null) {
          formattedResult = JSON.stringify(result);
        }

        console.alog?.(
          `[ReactLynxDebug] FiberElement API call #${++count}: ${fiberElementPAPIName}(${formattedArgs.join(', ')})${
            formattedResult == null ? '' : ` => ${formattedResult}`
          }`,
        );
        return result;
      };
    }
  });
}
