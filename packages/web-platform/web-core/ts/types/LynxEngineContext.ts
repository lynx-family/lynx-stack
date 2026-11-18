/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Cloneable } from './Cloneable.js';

/** The type and payload delivered to a main-thread context listener. */
export interface EngineMessageEvent<TData = Cloneable[] | undefined> {
  type: string;
  /**
   * Engine calls pack positional arguments into arrays. Engine teardown
   * carries `undefined` and Native teardown carries a numeric view ID.
   */
  data: TData;
}

/**
 * Synchronous context proxy returned by `lynx.getEngine()` or
 * `lynx.getNative()` on the main thread.
 */
export interface LynxEngineContext<TData = Cloneable[] | undefined> {
  addEventListener(
    type: string,
    listener: (event: EngineMessageEvent<TData>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: EngineMessageEvent<TData>) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  dispatchEvent(event: EngineMessageEvent<TData>): number;
  /**
   * Whether at least one listener is currently registered for `type`.
   *
   * The engine uses this to decide between the event channel and the legacy
   * direct-call path, mirroring `ContextProxy::HasEventListener` as used by
   * `TemplateAssembler::DispatchEventFromEngineToCoreContext`.
   */
  hasEventListener(type: string): boolean;
}
