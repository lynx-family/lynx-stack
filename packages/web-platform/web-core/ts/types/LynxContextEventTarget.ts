// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';

export type ContextCrossThreadEvent = {
  type: string;
  data: Cloneable;
};
export interface LynxContextEventTarget {
  onTriggerEvent?: (event: ContextCrossThreadEvent) => void;

  postMessage(message: any): void;
  dispatchEvent(
    event: ContextCrossThreadEvent,
  ): number;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
  ): void;
}
