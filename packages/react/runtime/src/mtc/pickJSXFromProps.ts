// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';

const MTC_TYPE = '__MTC_SLOT__' as const;

type MTCFactory = (...args: any[]) => MTCPlaceholder;
interface MTCPlaceholder {
  $$typeof: typeof MTC_TYPE;
  i: number;
}
type MTCPayload = Record<string, MTCPlaceholder | MTCFactory>;

function isPreactVnode(value: any): value is VNode {
  return (
    typeof Symbol != 'undefined' && Symbol.for && value && typeof value === 'object'
    && value.$$typeof === Symbol.for('react.element')
  );
}

export function pickJSXFromProps(props?: Record<string, any>): [[VNode, any][], MTCPayload] {
  if (!props) {
    return [[], {}];
  }

  const jsxs: [VNode, any][] = [];
  let index = 0;

  function traverse(item: any): any {
    if (item === null || item === undefined) {
      return item;
    }

    if (isPreactVnode(item)) {
      const placeholder = {
        $$typeof: MTC_TYPE,
        i: index,
      };
      index++;
      jsxs.push([item, placeholder]);
      return placeholder;
    }

    // Only props.children as a function is allowed for now.
    if (typeof item === 'function' && item.name === 'children') {
      const jsx = item(props);
      if (isPreactVnode(jsx)) {
        const placeholder = {
          $$typeof: MTC_TYPE,
          i: index,
        };
        jsxs.push([jsx, placeholder]);
        const wrapperFunction = (...args: any[]) => {
          item(...args);
          return placeholder;
        };
        index++;
        return wrapperFunction;
      }
    }

    if (Array.isArray(item)) {
      return item.map((item) => traverse(item));
    }

    if (typeof item === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(item)) {
        result[key] = traverse(value);
      }
      return result;
    }
    return item;
  }

  const transformedProps = traverse(props);
  return [jsxs, transformedProps];
}
