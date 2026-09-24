// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const destroyLifetimeEventName = '__DestroyLifetime';

export interface RuntimeEvent<Data = unknown> {
  type: string;
  data: Data;
  origin?: string;
}

export interface RuntimeEventTarget {
  addEventListener(
    type: string,
    listener: (event: RuntimeEvent) => void,
  ): void;
  dispatchEvent(event: RuntimeEvent): unknown;
  removeEventListener(
    type: string,
    listener: (event: RuntimeEvent) => void,
  ): void;
}

export interface LynxRuntimeHost {
  getCoreContext(): RuntimeEventTarget;
  getEngine(): RuntimeEventTarget;
  getJSContext(): RuntimeEventTarget;
}

export type EventName<Events extends object> = Extract<keyof Events, string>;

export type EventDispatcher<Events extends object> = <
  Name extends EventName<Events>,
>(
  name: Name,
  data: Events[Name],
) => void;

export type EventSubscriber<Events extends object> = <
  Name extends EventName<Events>,
>(
  name: Name,
  handler: (data: Events[Name]) => void,
) => () => void;
