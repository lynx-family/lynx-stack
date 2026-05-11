// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createElement as createElementBackground } from 'preact/compat';

import { createElement as createElementMainThread } from '@lynx-js/react/lepus';

type CreateElement = typeof import('preact/compat').createElement;
type CreateElementParams = Parameters<CreateElement>;

/**
 * export to users, and in framework would use preact createElement directly
 */
export const createElement =
  (function(type: CreateElementParams[0], props: CreateElementParams[1], ...rest: CreateElementParams[2][]) {
    const _baseCreateElement = __BACKGROUND__ ? createElementBackground : createElementMainThread as CreateElement;
    /**
     * for built-in element which would create snapshot instance
     *
     * 1. transform props to values
     * 2. transform children to $0 for slot v2
     */
    if (typeof type === 'string') {
      let key: string | undefined = undefined;
      let spreadProps = props ?? {};
      if (props && ('key' in props)) {
        const { key: keyValue, ...propsWithoutKey } = props as Record<string, unknown>;
        key = keyValue as string;
        spreadProps = propsWithoutKey;
      }
      return _baseCreateElement(
        type,
        Object.assign(
          {},
          {
            key,
            values: [{
              ...spreadProps,
              __spread: true,
            }],
          },
          rest.length > 0 ? { $0: rest.length > 1 ? rest : rest[0] } : undefined,
        ),
      );
    }
    return _baseCreateElement(type, props, ...rest);
  }) as CreateElement;
