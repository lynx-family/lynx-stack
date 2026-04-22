// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createElement as createElementBackground } from 'preact/compat';

import { createElement as createElementMainThread } from '@lynx-js/react/lepus';

type CreateElement = typeof import('preact/compat').createElement;
type CreateElementParams = Parameters<CreateElement>;

export const createElement =
  (function(type: CreateElementParams[0], props: CreateElementParams[1], ...rest: CreateElementParams[2][]) {
    const _baseCreateElement = __BACKGROUND__ ? createElementBackground : createElementMainThread as CreateElement;
    // transform children to $0 for slot v2
    if (typeof type === 'string' && rest.length > 0) {
      /* v8 ignore start */
      return _baseCreateElement(type, Object.assign({}, props, { $0: rest.length > 1 ? rest : rest[0] }));
      /* v8 ignore stop */
    }
    return _baseCreateElement(type, props, ...rest);
  }) as CreateElement;
