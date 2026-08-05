/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  AddEventListenerPAPI,
  AddEventPAPI,
  DecoratedHTMLElement,
  ElementEventListenerOptions,
  MainThreadScriptEvent,
  RemoveEventListenerPAPI,
} from '../../../types/index.js';
import { LynxEventNameToW3cCommon } from '../../../constants.js';
import { __GetElementUniqueID } from './pureElementPAPIs.js';
import { createCrossThreadEvent } from './createCrossThreadEvent.js';
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

interface ResolvedOptions {
  capture: boolean;
  once: boolean;
  passive: boolean;
  closureType: number;
  bindType: number;
  /** `capture-catch` / `catchEvent`: stop propagation after the handler runs. */
  catchEvent: boolean;
}

function resolveOptions(
  options: ElementEventListenerOptions | undefined,
): ResolvedOptions {
  const closureType = typeof options?.closure_type === 'number'
    ? options.closure_type
    : ClosureType.kNone;
  const bindType = typeof options?.bind_type === 'number'
    ? options.bind_type
    : BindType.kBubble;
  const isCaptureCatch = bindType === BindType.kCaptureCatch;
  const isBubbleCatch = bindType === BindType.kBubbleCatch;
  return {
    // `capture` is honoured for the plain addEventListener path; the bind
    // paths derive capture from `bind_type` instead, exactly as
    // `FiberAddEventListener` does.
    capture: closureType === ClosureType.kNone
      ? options?.capture === true
      : bindType === BindType.kCapture || isCaptureCatch,
    once: options?.once === true,
    passive: options?.passive === true,
    closureType,
    bindType,
    catchEvent: isCaptureCatch || isBubbleCatch,
  };
}

/**
 * Key identifying a registration. Matches the engine's `Matches()` contract for
 * `LepusClosureEventListener`, which compares the closure and the capture
 * flag — so `(element, name, callback, capture)` is the identity, and
 * `once`/`passive` are not part of it.
 */
function listenerKey(
  uniqueId: number,
  eventName: string,
  capture: boolean,
): string {
  return `${uniqueId}\u0000${eventName}\u0000${capture ? 'c' : 'b'}`;
}

/**
 * Element-level event listener PAPIs (`__AddEventListener` /
 * `__RemoveEventListener`).
 *
 * These are the *function callback* form of element event binding used by
 * buildless (vanilla) Lynx cards, as opposed to {@link AddEventPAPI}
 * (`__AddEvent`), which takes a string handler name or a worklet object and
 * routes dispatch through the Rust event delegation system.
 *
 * Because the callback here is a live main-thread closure that must be invoked
 * synchronously in the MTS realm, this implementation keeps its own JS-side
 * registry and attaches real DOM listeners to the element rather than pushing
 * the handler into wasm: a `JsValue` closure cannot round-trip through the
 * Rust handler tables (which store handler *names* for cross-thread dispatch
 * and worklet descriptors for MTS dispatch), and no wasm change is needed.
 */
export function createElementEventListenerAPIs(
  mtsBinding: WASMJSBinding,
  __AddEvent: AddEventPAPI,
): {
  __AddEventListener: AddEventListenerPAPI;
  __RemoveEventListener: RemoveEventListenerPAPI;
  disposeElementEventListeners: () => void;
} {
  /**
   * `(uniqueId, eventName, capture)` -> user callback -> the DOM listener that
   * wraps it. Needed because `__RemoveEventListener` is called with the
   * original callback, not the wrapper.
   */
  const registry = new Map<
    string,
    Map<(event: MainThreadScriptEvent) => void, {
      element: WeakRef<HTMLElement>;
      w3cEventName: string;
      domListener: (event: Event) => void;
      capture: boolean;
    }>
  >();

  function buildEventObject(
    domEvent: Event,
    currentTarget: HTMLElement,
  ): MainThreadScriptEvent {
    const eventObject = createCrossThreadEvent(
      domEvent as never,
      mtsBinding.lynxViewInstance.lynxViewClientLeft,
      mtsBinding.lynxViewInstance.lynxViewClientTop,
    ) as MainThreadScriptEvent;
    const target = (domEvent.target ?? currentTarget) as DecoratedHTMLElement;
    const wasmContext = mtsBinding.wasmContext;
    const datasetOf = (element: DecoratedHTMLElement) => {
      const uniqueId = __GetElementUniqueID(element);
      if (wasmContext && uniqueId >= 0) {
        try {
          return wasmContext.get_dataset(uniqueId) as Record<string, string>;
        } catch {
          // The element may already be detached from the wasm side.
        }
      }
      return {};
    };
    eventObject.target = Object.assign(
      mtsBinding.generateTargetObject(target, datasetOf(target)),
      { elementRefptr: target },
    );
    eventObject.currentTarget = Object.assign(
      mtsBinding.generateTargetObject(
        currentTarget as DecoratedHTMLElement,
        datasetOf(currentTarget as DecoratedHTMLElement),
      ),
      { elementRefptr: currentTarget },
    );
    return eventObject;
  }

  const __AddEventListener: AddEventListenerPAPI = (
    element,
    name,
    callback,
    options,
  ) => {
    const resolved = resolveOptions(options);
    const eventName = name.toLowerCase();

    // `native:bind` — the handler is a string naming a client method, which is
    // exactly what `__AddEvent` already routes cross-thread. Delegate instead
    // of duplicating the dispatch path.
    if (
      typeof callback === 'string'
      && resolved.closureType === ClosureType.kClient
    ) {
      __AddEvent(
        element,
        resolved.catchEvent ? 'catchEvent' : 'bindEvent',
        eventName,
        callback,
      );
      return;
    }

    if (typeof callback !== 'function') {
      return;
    }

    // `__GetElementUniqueID` yields -1 for anything not built through the
    // Element PAPIs. Such elements must not be keyed, or they would all share
    // one key and a listener added on one would be removable through another.
    const uniqueId = __GetElementUniqueID(element);
    if (uniqueId === -1) {
      return;
    }
    const key = listenerKey(uniqueId, eventName, resolved.capture);
    let listeners = registry.get(key);
    if (!listeners) {
      listeners = new Map();
      registry.set(key, listeners);
    }
    // Re-registering the same (element, name, callback, capture) triple is a
    // no-op, matching both `EventTarget` and the engine's `Matches()` dedup.
    if (listeners.has(callback)) {
      return;
    }

    const w3cEventName = LynxEventNameToW3cCommon[eventName] ?? eventName;
    const domListener = (domEvent: Event) => {
      if (resolved.once) {
        // Keep the registry in sync with the DOM's own `once` removal so a
        // later `__RemoveEventListener` (and disposal) stays consistent.
        listeners!.delete(callback);
        if (listeners!.size === 0) registry.delete(key);
      }
      if (resolved.catchEvent) {
        domEvent.stopPropagation();
      }
      callback(buildEventObject(domEvent, element));
    };

    listeners.set(callback, {
      element: new WeakRef(element),
      w3cEventName,
      domListener,
      capture: resolved.capture,
    });
    element.addEventListener(w3cEventName, domListener, {
      capture: resolved.capture,
      once: resolved.once,
      passive: resolved.passive,
    });
    // Custom elements such as `scroll-view` only emit some events once asked
    // to; the Rust `__AddEvent` path does the same for allowlisted events.
    mtsBinding.enableElementEvent(new WeakRef(element), eventName);
  };

  const __RemoveEventListener: RemoveEventListenerPAPI = (
    element,
    name,
    callback,
    options,
  ) => {
    const resolved = resolveOptions(options);
    const eventName = name.toLowerCase();

    if (
      typeof callback === 'string'
      && resolved.closureType === ClosureType.kClient
    ) {
      // Clear only the cross-thread slot. Routing this through `__AddEvent`
      // with `undefined` would take its "no identifier" branch, which also
      // clears the worklet handler for the same (element, type, name) triple -
      // detaching a `main-thread:bind` handler that this call never touched.
      const uniqueId = __GetElementUniqueID(element);
      if (uniqueId !== -1) {
        mtsBinding.wasmContext?.add_cross_thread_event(
          uniqueId,
          resolved.catchEvent ? 'catchEvent' : 'bindEvent',
          eventName,
          undefined,
        );
      }
      return;
    }

    if (typeof callback !== 'function') {
      return;
    }

    // `__GetElementUniqueID` yields -1 for anything not built through the
    // Element PAPIs. Such elements must not be keyed, or they would all share
    // one key and a listener added on one would be removable through another.
    const uniqueId = __GetElementUniqueID(element);
    if (uniqueId === -1) {
      return;
    }
    const key = listenerKey(uniqueId, eventName, resolved.capture);
    const listeners = registry.get(key);
    const registration = listeners?.get(callback);
    if (!registration) {
      return;
    }
    listeners!.delete(callback);
    if (listeners!.size === 0) {
      registry.delete(key);
    }
    element.removeEventListener(
      registration.w3cEventName,
      registration.domListener,
      registration.capture,
    );
  };

  /**
   * Detach every listener registered through `__AddEventListener`. Called on
   * teardown so a card that does not clean up after itself cannot leave
   * closures attached to elements that outlive the instance.
   */
  function disposeElementEventListeners(): void {
    for (const listeners of registry.values()) {
      for (const registration of listeners.values()) {
        registration.element.deref()?.removeEventListener(
          registration.w3cEventName,
          registration.domListener,
          registration.capture,
        );
      }
    }
    registry.clear();
  }

  return {
    __AddEventListener,
    __RemoveEventListener,
    disposeElementEventListeners,
  };
}
