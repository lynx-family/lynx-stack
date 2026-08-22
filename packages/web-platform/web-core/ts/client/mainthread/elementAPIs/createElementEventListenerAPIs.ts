/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  AddEventListenerPAPI,
  ElementEventListenerOptions,
  RemoveEventListenerPAPI,
} from '../../../types/index.js';
import { __GetElementUniqueID } from './pureElementPAPIs.js';
import type { WASMJSBinding } from './WASMJSBinding.js';

/**
 * `ClosureEventListener::ClosureType` from
 * `core/renderer/events/closure_event_listener.h`.
 */
const ClosureType = {
  kNone: 0,
  kJS: 1,
  kCore: 2,
  kClient: 3,
} as const;

/**
 * `Event::BindType` from `core/event/event.h`.
 */
const BindType = {
  kNone: 0,
  kBubble: 1,
  kCapture: 2,
  kCaptureCatch: 3,
  kBubbleCatch: 4,
  kGlobalBind: 5,
} as const;

/**
 * The event *type* a handler is filed under, which is what the dispatcher reads
 * to decide whether a handler runs during the capture or the bubble pass and
 * whether it stops propagation.
 *
 * These four names are the ones `dispatch_event_by_path` looks up, plus
 * `global-bindevent` for the separate global pass.
 */
function eventTypeOf(options: ElementEventListenerOptions | undefined): string {
  const closureType = typeof options?.closure_type === 'number'
    ? options.closure_type
    : ClosureType.kNone;
  const bindType = typeof options?.bind_type === 'number'
    ? options.bind_type
    : BindType.kBubble;

  if (bindType === BindType.kGlobalBind) {
    return 'global-bindevent';
  }
  // For a plain callback the web platform's own `capture` flag selects the
  // pass, because such a listener has no `bind_type` to derive it from. The
  // bind forms follow `bind_type`, exactly as `FiberAddEventListener` does.
  const capture = closureType === ClosureType.kNone
    ? options?.capture === true
    : bindType === BindType.kCapture || bindType === BindType.kCaptureCatch;
  const isCatch = bindType === BindType.kCaptureCatch
    || bindType === BindType.kBubbleCatch;

  if (capture) {
    return isCatch ? 'capture-catch' : 'capture-bind';
  }
  return isCatch ? 'catchevent' : 'bindevent';
}

/**
 * Element-level event listener PAPIs (`__AddEventListener` /
 * `__RemoveEventListener`).
 *
 * These are the *function callback* form of element event binding used by
 * buildless (vanilla) Lynx cards, as opposed to `__AddEvent`, which binds a
 * handler *name* dispatched across threads or a worklet object.
 *
 * Both forms are filed in the element's own handler table on the Rust side, so
 * a callback participates in the same dispatch as every other handler: one
 * delegated DOM listener per event name feeds `common_event_handler`, which
 * walks the ancestor path and runs the capture pass, the catch short-circuit,
 * the bubble pass and the global-bind pass. Binding directly with
 * `element.addEventListener` would instead create a second, parallel dispatch
 * that could neither stop nor be stopped by those handlers.
 *
 * `once` is handled here rather than in Rust: the slot is cleared before the
 * callback runs, so a re-entrant dispatch cannot deliver it twice. `passive` is
 * accepted and ignored, because the delegated listener - not the per-element
 * registration - is what decides passiveness, and it is already passive.
 */
export function createElementEventListenerAPIs(
  mtsBinding: WASMJSBinding,
): {
  __AddEventListener: AddEventListenerPAPI;
  __RemoveEventListener: RemoveEventListenerPAPI;
} {
  /**
   * The wrapper filed for a `once` registration, so that
   * `__RemoveEventListener` - which is called with the *original* callback - can
   * find what was actually registered.
   *
   * Keyed by element (weakly, so a collected element takes its entries with it)
   * and then by the full registration identity, `(eventName, eventType,
   * callback)`. Keying by callback alone would conflate registrations for
   * different events or passes on the same element.
   */
  const onceWrappers = new WeakMap<
    HTMLElement,
    Map<string, Map<unknown, (...args: unknown[]) => void>>
  >();
  const wrappersOf = (element: HTMLElement, slot: string) => {
    let bySlot = onceWrappers.get(element);
    if (!bySlot) {
      bySlot = new Map();
      onceWrappers.set(element, bySlot);
    }
    let wrappers = bySlot.get(slot);
    if (!wrappers) {
      wrappers = new Map();
      bySlot.set(slot, wrappers);
    }
    return wrappers;
  };
  /** Identifies a registration slot within one element. */
  const slotKey = (eventName: string, eventType: string) =>
    `${eventName}\u0000${eventType}`;

  const __AddEventListener: AddEventListenerPAPI = (
    element,
    name,
    callback,
    options,
  ) => {
    // `__GetElementUniqueID` yields -1 for anything not built through the
    // Element PAPIs, which therefore has no handler table to file into.
    const uniqueId = __GetElementUniqueID(element);
    if (uniqueId === -1) {
      return;
    }
    const eventName = name.toLowerCase();
    const eventType = eventTypeOf(options);

    if (typeof callback === 'string') {
      // `native:bind`: the callback is a handler *name*, which is dispatched to
      // the host rather than invoked here.
      mtsBinding.wasmContext?.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        callback,
      );
      return;
    }
    if (typeof callback !== 'function') {
      return;
    }

    const slot = slotKey(eventName, eventType);
    const wrappers = wrappersOf(element, slot);
    const existingWrapper = wrappers.get(callback);

    if (options?.once !== true) {
      // Re-registering the same callback without `once` has to drop the wrapper
      // a previous `once` registration filed, otherwise both would run.
      if (existingWrapper) {
        mtsBinding.wasmContext?.add_closure_event(
          uniqueId,
          eventType,
          eventName,
          undefined,
          existingWrapper,
        );
        wrappers.delete(callback);
      }
      mtsBinding.wasmContext?.add_closure_event(
        uniqueId,
        eventType,
        eventName,
        callback,
        undefined,
      );
      return;
    }

    // Already registered for this exact identity, so this is a no-op, as with
    // `EventTarget`. Filing a second wrapper would make the callback run twice
    // and orphan the first wrapper, which nothing could then remove.
    if (existingWrapper) {
      return;
    }

    // The same callback may already be filed *unwrapped* by an earlier
    // registration without `once`. `EventTarget` treats that as the same
    // listener and ignores the second add, so drop the bare one rather than
    // letting both run.
    mtsBinding.wasmContext?.add_closure_event(
      uniqueId,
      eventType,
      eventName,
      undefined,
      callback,
    );

    // `once` lives here rather than in the handler table. The registration is
    // dropped before the callback runs, so a re-entrant dispatch cannot see it
    // and a callback that re-registers itself files a fresh wrapper rather than
    // racing a pending removal. The flag is the second line of defence: the
    // dispatcher reads an element's callbacks out before running any of them,
    // so removing one mid-walk does not un-list what it already snapshotted.
    let fired = false;
    const wrapper = (...args: unknown[]) => {
      if (fired) {
        return;
      }
      fired = true;
      mtsBinding.wasmContext?.add_closure_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
        wrapper,
      );
      wrappers.delete(callback);
      (callback as (...args: unknown[]) => void)(...args);
    };
    wrappers.set(callback, wrapper);
    mtsBinding.wasmContext?.add_closure_event(
      uniqueId,
      eventType,
      eventName,
      wrapper,
      undefined,
    );
  };

  const __RemoveEventListener: RemoveEventListenerPAPI = (
    element,
    name,
    callback,
    options,
  ) => {
    const uniqueId = __GetElementUniqueID(element);
    if (uniqueId === -1) {
      return;
    }
    const eventName = name.toLowerCase();
    const eventType = eventTypeOf(options);

    if (typeof callback === 'string') {
      // Clear only the cross-thread slot, so removing a `native:bind` handler
      // cannot disturb a callback or a worklet bound to the same triple.
      mtsBinding.wasmContext?.add_cross_thread_event(
        uniqueId,
        eventType,
        eventName,
        undefined,
      );
      return;
    }

    // A `once` registration was filed as a wrapper, so removal has to target
    // that wrapper rather than the callback the caller hands back.
    const slot = slotKey(eventName, eventType);
    const wrappers = onceWrappers.get(element)?.get(slot);
    const registered = wrappers?.get(callback) ?? callback;
    wrappers?.delete(callback);
    mtsBinding.wasmContext?.add_closure_event(
      uniqueId,
      eventType,
      eventName,
      undefined,
      registered,
    );
  };

  return { __AddEventListener, __RemoveEventListener };
}
