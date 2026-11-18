// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertScopeAlive, getScopeLynx } from './scope.js';
import type { BTSEventEntry, BTSPageScope } from './scope.js';
import type { HostGlobalEventEmitter } from '../common/host-types.js';
import { subscribeMultiplexed } from '../common/messages.js';
import type { BTSEventHandler, Unsubscribe } from '../common/types.js';

function createEventEntry(): BTSEventEntry {
  const dispatch: BTSEventHandler = (handlerName, data, componentId) => {
    const handler = entry.current?.handler;
    return handler?.(handlerName, data, componentId);
  };
  const entry: BTSEventEntry = {
    current: undefined,
    publishEvent: (handlerName, data) => dispatch(handlerName, data),
    publicComponentEvent: (componentId, handlerName, data) =>
      dispatch(handlerName, data, componentId),
  };
  return entry;
}

/** @internal */
export function scopeSetEventHandler<T>(
  scope: BTSPageScope,
  handler: BTSEventHandler<T>,
): Unsubscribe {
  assertScopeAlive(scope);
  let entry = scope.eventEntry;
  if (!entry) {
    entry = scope.eventEntry = createEventEntry();
    // Both host slots share one owner; never chain an unmigrated DSL handler.
    scope.app.publishEvent = entry.publishEvent;
    scope.app.publicComponentEvent = entry.publicComponentEvent;
  }
  const registration = { handler: handler as BTSEventHandler };
  entry.current = registration;
  const currentEntry = entry;
  return () => {
    if (currentEntry.current === registration) {
      currentEntry.current = undefined;
    }
  };
}

function getGlobalEventEmitter(scope: BTSPageScope): HostGlobalEventEmitter {
  let emitter = (scope.app.getJSModule?.('GlobalEventEmitter') as
    | HostGlobalEventEmitter
    | null
    | undefined) ?? scope.app.GlobalEventEmitter;
  if (!emitter) {
    const scopeLynx = getScopeLynx(scope);
    if (scopeLynx && (!scopeLynx.getApp || scopeLynx.getApp() === scope.app)) {
      emitter = scopeLynx.getJSModule?.('GlobalEventEmitter') as
        | HostGlobalEventEmitter
        | null
        | undefined;
    }
  }
  if (!emitter) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Global event subscription requires GlobalEventEmitter. Ensure the BTS host environment is initialized before calling onGlobalEvent().',
    );
  }
  return emitter;
}

/**
 * Share one host listener per event name on the bound page's GlobalEventEmitter so
 * disposing one subscriber does not disable shared host detectors (such as
 * `keyboardstatuschanged`) or mutate lynx-core's array during `forEach` dispatch.
 * @internal
 */
export function scopeOnGlobalEvent<Args extends unknown[]>(
  scope: BTSPageScope,
  name: string,
  listener: (this: void, ...args: Args) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  scope.globalEvents ??= new Map();
  return subscribeMultiplexed(
    scope.globalEvents,
    name,
    listener as (...args: unknown[]) => void,
    (dispatch) => {
      const emitter = getGlobalEventEmitter(scope);
      const onEvent = (...args: unknown[]): void => {
        dispatch((fn) => {
          fn(...args);
        });
      };
      emitter.addListener(name, onEvent);
      return () => {
        emitter.removeListener(name, onEvent);
      };
    },
  );
}
