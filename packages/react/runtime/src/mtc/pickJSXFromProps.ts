// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';

type JSXRecord = Record<string, {
  $$typeof: symbol;
  i: number;
}>;

function isPreactVnode(value: any): value is VNode {
  return (
    typeof Symbol != 'undefined' && Symbol.for && value && typeof value === 'object'
    && value.$$typeof === Symbol.for('react.element')
  );
}

export function pickJSXFromProps(props: Record<string, any>): [VNode[], JSXRecord] {
  const jsxs: VNode[] = [];
  let index = 0;

  function traverse(item: any): any {
    if (item === null || item === undefined) {
      return item;
    }

    if (isPreactVnode(item)) {
      jsxs.push(item);
      const placeholder = {
        $$typeof: Symbol.for('mtc-slot'),
        i: index,
      };
      index++;
      return placeholder;
    }

    if (typeof item === 'function') {
      const jsx = item();
      if (isPreactVnode(jsx)) {
        jsxs.push(jsx);
        const wrapperFunction = (...args: any[]) => {
          item(...args);
          return {
            $$typeof: Symbol.for('mtc-slot'),
            i: index,
          };
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
