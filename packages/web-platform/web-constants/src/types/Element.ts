// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxEventType } from './EventType.js';

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
  list: WebFiberElementImpl,
  listID: number,
  cellIndex: number,
  operationID: number,
  enableReuseNotification: boolean,
) => void;

export type EnqueueComponentCallback = (
  list: WebFiberElementImpl,
  listID: number,
  sign: number,
) => void;

export const enum AnimationOperation {
  START = 0,
  PLAY,
  PAUSE,
  CANCEL,
  FINISH,
}

export interface ElementAnimationOptions {
  operation: AnimationOperation;
  id: string;
  keyframes?: any;
  timingOptions?: Record<string, any>;
}

export interface WebFiberElementImpl {
  querySelectorAll?: (selectors: string) => WebFiberElementImpl[];
  getAttributeNames: () => string[];
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  append: (...children: WebFiberElementImpl[]) => void;
  appendChild: (child: WebFiberElementImpl) => void;
  removeChild: (child: WebFiberElementImpl) => WebFiberElementImpl;
  insertBefore: (
    child: WebFiberElementImpl,
    ref?: WebFiberElementImpl | null,
  ) => WebFiberElementImpl;
  replaceWith: (...newElement: WebFiberElementImpl[]) => void;
  addEventListener: (
    type: string,
    handler: (ev: Event) => void,
    options: {
      capture?: boolean;
      passive?: boolean;
    },
  ) => void;
  removeEventListener: (
    type: string,
    handler: (ev: Event) => void,
    options?: {
      capture?: boolean;
    },
  ) => void;
  textContent: string;
  readonly tagName: string;
  readonly firstElementChild: WebFiberElementImpl | null;
  readonly children: WebFiberElementImpl[];
  readonly parentElement: WebFiberElementImpl | null;
  readonly parentNode: WebFiberElementImpl | null;
  readonly lastElementChild: WebFiberElementImpl | null;
  readonly nextElementSibling: WebFiberElementImpl | null;
  readonly style: {
    removeProperty(name: string): void;
    setProperty(
      name: string,
      value: string,
      priority?: 'important' | '' | null,
    ): void;
  };
}
