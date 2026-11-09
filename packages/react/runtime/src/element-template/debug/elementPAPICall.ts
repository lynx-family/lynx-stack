// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  debugValueType,
  formatDebugArgs,
  formatDebugValue,
  truncateDebugString,
  tryEndDebugProfile,
  tryStartDebugProfile,
} from '../../shared/debug-logging.js';

const elementTemplatePAPINameList = [
  '__CreateElementTemplate',
  '__CreateTypedElementTemplate',
  '__SetAttributeOfElementTemplate',
  '__InsertNodeToElementTemplate',
  '__RemoveNodeFromElementTemplate',
  '__FlushElementTree',
  '__SerializeElementTemplate',
] as const;

export function initElementTemplatePAPICallAlog(globalWithIndex: Record<string, unknown> = globalThis): void {
  let count = 0;
  const elementTemplateMap = new Map<unknown, string>();

  const format = (value: unknown, previewStrings: boolean) =>
    elementTemplateMap.get(value) ?? formatDebugValue(value, previewStrings);
  const summarizeAttribute = ([target, slot, value]: unknown[]) => ({
    target: format(target, false),
    slot: format(slot, false),
    valueType: debugValueType(value),
  });

  for (const name of elementTemplatePAPINameList) {
    const native = globalWithIndex[name];
    if (typeof native !== 'function') {
      continue;
    }
    const callNative = native as (...args: unknown[]) => unknown;
    globalWithIndex[name] = (...args: unknown[]): unknown => {
      const shouldProfile = typeof __PROFILE__ !== 'undefined' && __PROFILE__;
      const started = shouldProfile
        && tryStartDebugProfile(`ElementTemplatePAPI: ${name}`, () =>
          name === '__SetAttributeOfElementTemplate'
            ? summarizeAttribute(args)
            : { args: formatDebugArgs(args, value => format(value, false)) });
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
        if (result != null && typeof args[0] === 'string') {
          if (name === '__CreateElementTemplate' && typeof args[4] === 'number') {
            elementTemplateMap.set(result, `${truncateDebugString(args[0])}#${args[4]}`);
          } else if (name === '__CreateTypedElementTemplate' && typeof args[3] === 'number') {
            elementTemplateMap.set(result, `${truncateDebugString(args[0])}#${args[3]}`);
          }
        }
        if (console.alog) {
          const prefix = `[ReactLynxDebug] ElementTemplate API call #${++count}: ${name}`;
          if (name === '__SetAttributeOfElementTemplate') {
            const { target, slot, valueType } = summarizeAttribute(args);
            const preview = typeof args[2] === 'string' ? ` preview=${formatDebugValue(args[2], true)}` : '';
            console.alog(`${prefix} target=${target} slot=${slot} valueType=${valueType}${preview}`);
          } else {
            const summary = formatDebugArgs(args, value => format(value, true));
            console.alog(`${prefix}(${summary})${result == null ? '' : ` => ${format(result, true)}`}`);
          }
        }
      } catch {
        // Handle lookup and logging are diagnostic only.
      }
      return result;
    };
  }
}
