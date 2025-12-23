// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';
import { selectComponentEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';
import { IdentifierType } from '../../../constants.js';

export function registerSelectComponentHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
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
        lynxViewInstance,
        IdentifierType.ID_SELECTOR,
        idSelector,
        componentId === 'card' ? '0' : componentId,
        single,
        undefined,
        (ele) => {
          element = ele;
        },
      );

      return [
        lynxViewInstance.mainThreadGlobalThis.__GetComponentID(
          element as HTMLElement,
        ),
      ];
    },
  );
}
