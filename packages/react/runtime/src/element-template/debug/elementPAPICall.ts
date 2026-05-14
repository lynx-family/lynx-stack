// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { profileEnd, profileStart } from '../../shared/profile.js';

const elementTemplatePAPINameList = [
  '__CreateElementTemplate',
  '__SetAttributeOfElementTemplate',
  '__InsertNodeToElementTemplate',
  '__RemoveNodeFromElementTemplate',
  '__SerializeElementTemplate',
] as const;

export function initElementTemplatePAPICallAlog(globalWithIndex: Record<string, unknown> = globalThis): void {
  let count = 0;
  const elementTemplateMap = new Map<unknown, string>();

  for (const elementTemplatePAPIName of elementTemplatePAPINameList) {
    const oldElementTemplatePAPI = globalWithIndex[elementTemplatePAPIName];
    if (typeof oldElementTemplatePAPI !== 'function') {
      continue;
    }
    const callElementTemplatePAPI = oldElementTemplatePAPI as (...args: unknown[]) => unknown;

    globalWithIndex[elementTemplatePAPIName] = (...args: unknown[]): unknown => {
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileStart(`ElementTemplatePAPI: ${elementTemplatePAPIName}`, {
          args: {
            args: formatValue(args, elementTemplateMap),
          },
        });
      }

      const result = callElementTemplatePAPI(...args);

      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileEnd();
      }

      if (elementTemplatePAPIName === '__CreateElementTemplate' && result != null) {
        elementTemplateMap.set(result, `${String(args[0])}#${String(args[4])}`);
      }

      const formattedResult = result == null ? undefined : formatValue(result, elementTemplateMap);
      console.alog?.(
        `[ReactLynxDebug] ElementTemplate API call #${++count}: ${elementTemplatePAPIName}(${
          args.map(arg => formatValue(arg, elementTemplateMap)).join(', ')
        })${formattedResult == null ? '' : ` => ${formattedResult}`}`,
      );
      return result;
    };
  }
}

function formatValue(value: unknown, elementTemplateMap: Map<unknown, string>): string {
  if (elementTemplateMap.has(value)) {
    return elementTemplateMap.get(value)!;
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(item => formatValue(item, elementTemplateMap)).join(', ') + ']';
  }
  if (typeof value === 'function') {
    return `[Function${value.name ? ` ${value.name}` : ''}]`;
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  try {
    const formatted = JSON.stringify(value);
    return formatted ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
