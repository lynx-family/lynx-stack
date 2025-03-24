// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  componentIdAttribute,
  triggerComponentEventEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerTriggerComponentEventHandler(
  rpc: Rpc,
  shadowRoot: ShadowRoot,
) {
  rpc.registerHandler(
    triggerComponentEventEndpoint,
    (
      id,
      params,
    ) => {
      const componentDom = shadowRoot.querySelector(
        `[${componentIdAttribute}="${params.componentId}"]`,
      );
      componentDom?.dispatchEvent(
        new CustomEvent(id, {
          ...params.eventOption,
          detail: params.eventDetail,
        }),
      );
    },
  );
}
