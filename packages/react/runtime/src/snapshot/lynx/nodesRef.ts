// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NodesRef } from '@lynx-js/types';

import { RefProxy } from '../lifecycle/ref/delay.js';

export interface NodeSelectToken {
  identifier: string;
}

export const serializeNodesRef = (nodesRef: NodesRef): string => {
  if (nodesRef instanceof RefProxy) {
    return nodesRef.selector;
  }

  // TODO: any better way to serialize nodesRef?
  const nodeSelectToken = (nodesRef as unknown as {
    _nodeSelectToken: NodeSelectToken;
  })._nodeSelectToken;
  return nodeSelectToken.identifier;
};
