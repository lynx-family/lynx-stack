// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NodesRef } from '@lynx-js/types';

import { RefProxy } from '../lifecycle/ref/delay.js';

/**
 * `_nodeSelectToken.type` values produced by Lynx core's selector query:
 *   - `0` = CSS selector (`select` / `selectAll` / `selectRoot`)
 *   - `1` = React ref (`selectReactRef`)
 *   - `2` = element unique id (`selectUniqueID`)
 *
 * We only support type `0` — the apply side resolves it via
 * `__QuerySelector`. Types `1` / `2` would need their own lookup PAPIs
 * (`__GetElementByUniqueId`, etc.) which we don't wire today.
 */
const NodeSelectType = {
  Selector: 0,
  ReactRef: 1,
  UniqueID: 2,
};

export interface NodeSelectToken {
  type: number;
  identifier: string;
}

export const serializeNodesRef = (nodesRef: NodesRef): string => {
  if (nodesRef instanceof RefProxy) {
    // `RefProxy.selector` is a `[react-ref-X-Y]` CSS attribute selector.
    return nodesRef.selector;
  }

  const nodeSelectToken = (nodesRef as unknown as {
    _nodeSelectToken: NodeSelectToken;
  })._nodeSelectToken;
  if (nodeSelectToken.type !== NodeSelectType.Selector) {
    throw new Error(
      `[createPortal] unsupported NodesRef type ${nodeSelectToken.type} `
        + `(identifier ${JSON.stringify(nodeSelectToken.identifier)}). `
        + `Pass a CSS-selector NodesRef from \`lynx.createSelectorQuery().select(...)\` `
        + `or a React ref instead.`,
    );
  }
  return nodeSelectToken.identifier;
};
