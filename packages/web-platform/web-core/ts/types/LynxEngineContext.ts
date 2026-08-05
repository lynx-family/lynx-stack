/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ContextCrossThreadEvent } from './LynxContextEventTarget.js';
import type { Cloneable } from './Cloneable.js';

/**
 * The event object an Engine context listener receives.
 *
 * A plain `{ type, data }` object rather than a DOM event: the engine hands
 * lepus the same shape via
 * `LepusClosureEventListener::ConvertEventToLepusValue`, which copies `type`
 * and `data` off the `MessageEvent`. `data` holds the engine call's positional
 * arguments as an array, matching the `lepus::CArray` packing in
 * `DispatchEventFromEngineToCoreContext`.
 */
export interface EngineMessageEvent {
  type: string;
  data: Cloneable;
}

/**
 * The object returned by `lynx.getEngine()` on the main thread.
 *
 * This is the web counterpart of `ContextProxy::Type::kEngine`
 * (`core/runtime/common/bindings/event/context_proxy.h`). Unlike
 * {@link LynxContextEventTarget}, which bridges two workers over RPC, the
 * Engine proxy is main-thread-internal: the engine (the `lynx-view` host) is
 * the event *origin* and the main-thread script is the *target*, so events are
 * delivered synchronously without crossing a thread boundary.
 */
export interface LynxEngineContext {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  dispatchEvent(event: ContextCrossThreadEvent): number;
  /**
   * Whether at least one listener is currently registered for `type`.
   *
   * The engine uses this to decide between the event channel and the legacy
   * direct-call path, mirroring `ContextProxy::HasEventListener` as used by
   * `TemplateAssembler::DispatchEventFromEngineToCoreContext`.
   */
  hasEventListener(type: string): boolean;
}
