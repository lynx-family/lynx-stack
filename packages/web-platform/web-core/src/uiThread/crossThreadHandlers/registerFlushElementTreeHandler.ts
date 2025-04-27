// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  flushElementTreeEndpoint,
  postOffscreenEventEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { initOffscreenDocument } from '@lynx-js/offscreen-document/main';

export function registerFlushElementTreeHandler(
  mainThreadRpc: Rpc,
  options: {
    shadowRoot: ShadowRoot;
  },
) {
  const {
    shadowRoot,
  } = options;
  const onEvent = mainThreadRpc.createCall(postOffscreenEventEndpoint);
  const { decodeOperation } = initOffscreenDocument({
    shadowRoot,
    onEvent,
  });
  mainThreadRpc.registerHandler(
    flushElementTreeEndpoint,
    (operations) => {
      decodeOperation(operations);
    },
  );
}
