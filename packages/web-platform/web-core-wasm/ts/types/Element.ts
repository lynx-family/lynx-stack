// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxEventType } from './EventType.js';
import { uniqueIdSymbol, type AnimationOperation } from '../constants.js';

export type DecoratedHTMLElement = HTMLElement & {
  [uniqueIdSymbol]: number;
  componentAtIndex?: ComponentAtIndexCallback;
  enqueueComponent?: EnqueueComponentCallback;
};

export interface LynxRuntimeInfo {
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
  componentAtIndex?: ComponentAtIndexCallback;
  enqueueComponent?: EnqueueComponentCallback;
}

export type ComponentAtIndexCallback = (
  list: HTMLElement,
  listID: number,
  cellIndex: number,
  operationID: number,
  enableReuseNotification: boolean,
) => void;

export type EnqueueComponentCallback = (
  list: HTMLElement,
  listID: number,
  sign: number,
) => void;

export interface ElementAnimationOptions {
  operation: AnimationOperation;
  id: string;
  keyframes?: any;
  timingOptions?: Record<string, any>;
}
