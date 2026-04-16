// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxApi } from '@lynx-js/types';

export interface Event {
  type: string;
  data: unknown;
  origin?: string;
}

export class RuntimeProxy {
  dispatchEvent(event: RuntimeProxy.Event): void;

  postMessage(message: unknown);

  addEventListener(type: string, callback: (event: RuntimeProxy.Event) => void);

  removeEventListener(
    type: string,
    callback: (event: RuntimeProxy.Event) => void,
  );

  onTriggerEvent(callback: (event: RuntimeProxy.Event) => void);
}

declare module '@lynx-js/types' {
  interface Lynx extends LynxApi {
    getJSContext(): RuntimeProxy;
  }
}
