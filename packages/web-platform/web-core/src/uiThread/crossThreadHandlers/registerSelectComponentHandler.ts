// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  componentIdAttribute,
  IdentifierType,
  selectComponentEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';

export function registerSelectComponentHandler(
  rpc: Rpc,
  shadowRoot: ShadowRoot,
) {
  let element: Element | null;
  rpc.registerHandler(
    selectComponentEndpoint,
    (
      componentId,
      idSelector,
      single,
    ) => {
      queryNodes(
        shadowRoot,
        IdentifierType.ID_SELECTOR,
        idSelector,
        componentId === 'card' ? '0' : componentId,
        single,
        undefined,
        (ele) => {
          element = ele;
        },
      );

      return [element?.getAttribute(componentIdAttribute) ?? undefined];
    },
  );
}
