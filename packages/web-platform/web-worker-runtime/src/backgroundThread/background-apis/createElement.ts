// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { triggerElementMethodEndpoint } from '@lynx-js/web-constants';
import type { AnimationOperation } from '@lynx-js/web-constants/src/types/Element.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export const createElement = (elementId: string, uiThreadRpc: Rpc) => {
  const triggerElementMethod = uiThreadRpc.createCall(
    triggerElementMethodEndpoint,
  );

  return {
    animate(
      operation: AnimationOperation,
      id: string,
      keyframes?: Record<string, any>[],
      timingOptions?: Record<string, any>,
    ) {
      triggerElementMethod('animate', elementId, {
        operation,
        id,
        keyframes,
        timingOptions,
      });
    },
  };
};
