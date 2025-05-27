// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  // componentIdAttribute,
  triggerElementMethodEndpoint,
} from '@lynx-js/web-constants';
import {
  AnimationOperation,
  type ElementAnimationOptions,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerTriggerElementMethodEndpointHandler(
  rpc: Rpc,
  shadowRoot: ShadowRoot,
) {
  const animationMap = new Map<string, Animation | undefined>();

  rpc.registerHandler(
    triggerElementMethodEndpoint,
    (
      method,
      id,
      options: ElementAnimationOptions,
    ) => {
      if (method === 'animate') {
        switch (options.operation) {
          case AnimationOperation.START:
            animationMap.set(
              options.id,
              shadowRoot.querySelector(id)?.animate(
                options.keyframes,
                options.timingOptions,
              ),
            );
            break;
          case AnimationOperation.PLAY:
            animationMap.get(options.id)?.play();
            break;
          case AnimationOperation.PAUSE:
            animationMap.get(options.id)?.pause();
            break;
          case AnimationOperation.CANCEL:
            animationMap.get(options.id)?.cancel();
            break;
          case AnimationOperation.FINISH:
            animationMap.get(options.id)?.finish();
            break;
        }
      }
    },
  );
}
