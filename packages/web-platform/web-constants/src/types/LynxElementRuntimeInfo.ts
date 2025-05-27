// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';
import type { LynxEventType } from './EventType.js';

export interface LynxRuntimeInfo {
  uniqueId: number;
  parentComponentUniqueId: number;
  componentConfig: Record<string, Cloneable>;
  lynxDataset: Record<string, Cloneable>;
  eventHandlerMap: Record<string, {
    capture: {
      type: LynxEventType;
      handler: string | { type: 'worklet'; value: unknown };
    } | undefined;
    bind: {
      type: LynxEventType;
      handler: string | { type: 'worklet'; value: unknown };
    } | undefined;
  }>;
  componentAtIndex?: ComponentAtIndexCallback | undefined;
  enqueueComponent?: EnqueueComponentCallback | undefined;
}

export type ComponentAtIndexCallback = (
  list: unknown, /* HTMLElement */
  listID: number,
  cellIndex: number,
  operationID: number,
  enableReuseNotification: boolean,
) => void;

export type EnqueueComponentCallback = (
  list: unknown, /* HTMLElement */
  listID: number,
  sign: number,
) => void;
