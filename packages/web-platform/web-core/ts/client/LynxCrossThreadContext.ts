// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { dispatchCoreContextOnBackgroundEndpoint } from './endpoints.js';
import type { LynxContextEventTarget } from '../types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export const DispatchEventResult = {
  // Event was not canceled by event handler or default event handler.
  NotCanceled: 0,
  // Event was canceled by event handler; i.e. a script handler calling
  // preventDefault.
  CanceledByEventHandler: 1,
  // Event was canceled by the default event handler; i.e. executing the default
  // action.  This result should be used sparingly as it deviates from the DOM
  // Event Dispatch model. Default event handlers really shouldn't be invoked
  // inside of dispatch.
  CanceledByDefaultEventHandler: 2,
  // Event was canceled but suppressed before dispatched to event handler.  This
  // result should be used sparingly; and its usage likely indicates there is
  // potential for a bug. Trusted events may return this code; but untrusted
  // events likely should always execute the event handler the developer intends
  // to execute.
  CanceledBeforeDispatch: 3,
} as const;

type LynxCrossThreadContextConfig = {
  rpc: Rpc;
  receiveEventEndpoint: typeof dispatchCoreContextOnBackgroundEndpoint;
  sendEventEndpoint: typeof dispatchCoreContextOnBackgroundEndpoint;
};
export class LynxCrossThreadContext extends EventTarget
  implements LynxContextEventTarget
{
  #config: LynxCrossThreadContextConfig;
  constructor(
    config: LynxCrossThreadContextConfig,
  ) {
    super();
    this.#config = config;
  }
  postMessage(...args: any[]) {
    console.error('[lynx-web] postMessage not implemented, args:', ...args);
  }
  // @ts-expect-error
  override dispatchEvent(event: ContextCrossThreadEvent) {
    const { rpc, sendEventEndpoint } = this.#config;
    rpc.invoke(sendEventEndpoint, [event]);
    return DispatchEventResult.CanceledBeforeDispatch;
  }
  __start() {
    const { rpc, receiveEventEndpoint } = this.#config;
    rpc.registerHandler(receiveEventEndpoint, ({ type, data }) => {
      super.dispatchEvent(new MessageEvent(type, { data: data ?? {} }));
    });
  }
}
