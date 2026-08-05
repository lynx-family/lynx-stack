/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  Cloneable,
  ContextCrossThreadEvent,
  EngineMessageEvent,
  LynxEngineContext,
} from '../../types/index.js';
import { DispatchEventResult } from '../LynxCrossThreadContext.js';

interface Registration {
  listener: (event: Event) => void;
  once: boolean;
}

/**
 * Main-thread-local implementation of the Engine context proxy
 * (`ContextProxy::Type::kEngine`).
 *
 * Buildless (vanilla) Lynx cards subscribe to engine lifecycle events instead
 * of exporting `globalThis.renderPage` / `globalThis.updatePage`:
 *
 * ```js
 * const engine = lynx.getEngine();
 * engine.addEventListener('__RenderPage', onRenderPage);
 * engine.addEventListener('__DestroyLifetime', cleanup);
 * ```
 *
 * The engine side (`LynxViewInstance`) must consult {@link hasEventListener}
 * before dispatching and fall back to the direct global call when no listener
 * is registered — this is what keeps existing ReactLynx bundles working. See
 * `TemplateAssembler::DispatchEventFromEngineToCoreContext` and
 * {@link dispatchEngineEventWithFallback}.
 *
 * Unlike `LynxCrossThreadContext`, this is not backed by a DOM `EventTarget`.
 * The engine and the main-thread script share a thread, so there is no event
 * tree to propagate through and no RPC hop; listeners are invoked
 * synchronously and receive a plain `{ type, data }` object. That mirrors the
 * engine, where `LepusClosureEventListener::ConvertEventToLepusValue` hands
 * a `MessageEvent` to lepus as a plain object carrying `type` and `data`
 * rather than as a DOM event.
 */
export class LynxEngineContextImpl implements LynxEngineContext {
  /**
   * `type` -> capture flag -> registrations, in insertion order.
   *
   * `capture` is part of listener identity for `EventTarget` parity (adding
   * the same callback once capturing and once bubbling yields two
   * registrations), even though there is no tree to capture through.
   */
  #listeners: Map<
    string,
    Map<boolean, Map<(event: Event) => void, Registration>>
  > = new Map();

  static #captureOf(
    options?: boolean | AddEventListenerOptions | EventListenerOptions,
  ): boolean {
    return typeof options === 'boolean' ? options : options?.capture === true;
  }

  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (typeof listener !== 'function') return;
    const capture = LynxEngineContextImpl.#captureOf(options);
    let byCapture = this.#listeners.get(type);
    if (!byCapture) {
      byCapture = new Map();
      this.#listeners.set(type, byCapture);
    }
    let registrations = byCapture.get(capture);
    if (!registrations) {
      registrations = new Map();
      byCapture.set(capture, registrations);
    }
    // Re-adding the same (type, listener, capture) triple is a no-op, matching
    // `EventTarget`.
    if (registrations.has(listener)) return;
    registrations.set(listener, {
      listener,
      once: typeof options === 'object' && options?.once === true,
    });
  }

  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void {
    const capture = LynxEngineContextImpl.#captureOf(options);
    const byCapture = this.#listeners.get(type);
    const registrations = byCapture?.get(capture);
    if (!registrations?.delete(listener)) return;
    if (registrations.size === 0) byCapture!.delete(capture);
    if (byCapture!.size === 0) this.#listeners.delete(type);
  }

  /**
   * Whether at least one listener is registered for `type`, regardless of its
   * capture flag. This is the web counterpart of
   * `ContextProxy::HasEventListener`, which the engine consults to choose
   * between the event channel and the legacy direct call.
   */
  hasEventListener(type: string): boolean {
    return this.#listeners.has(type);
  }

  /**
   * Dispatch an engine message event to the main-thread script.
   *
   * Accepts the `{ type, data }` shape used by `LynxCrossThreadContext` so
   * card code can dispatch onto the engine proxy with the same call shape it
   * uses for `lynx.getJSContext()`.
   *
   * Listeners run synchronously. A throwing listener is reported and does not
   * prevent the remaining listeners from running, matching `EventTarget`.
   */
  dispatchEvent(event: ContextCrossThreadEvent): number {
    const byCapture = this.#listeners.get(event.type);
    if (!byCapture) return DispatchEventResult.NotCanceled;

    const messageEvent: EngineMessageEvent = {
      type: event.type,
      data: event.data,
    };
    // Capture listeners first, then bubble ones, mirroring DOM ordering.
    for (const capture of [true, false]) {
      const registrations = byCapture.get(capture);
      if (!registrations) continue;
      // Snapshot: a listener may add or remove listeners while running.
      for (const registration of [...registrations.values()]) {
        if (registration.once) {
          this.removeEventListener(event.type, registration.listener, capture);
        }
        try {
          registration.listener(messageEvent as unknown as Event);
        } catch (e) {
          console.error(
            `[lynx-web] error in engine "${event.type}" listener`,
            e,
          );
        }
      }
    }
    return DispatchEventResult.NotCanceled;
  }

  /**
   * Drop every listener. Called on teardown *after* `__DestroyLifetime` has
   * been delivered, so a card that forgets to unsubscribe cannot keep the
   * main-thread realm alive through this proxy.
   */
  dispose(): void {
    this.#listeners.clear();
  }
}

/**
 * Deliver an engine lifecycle event to the main-thread script, mirroring
 * `TemplateAssembler::DispatchEventFromEngineToCoreContext`:
 *
 * - if the Engine context proxy has a listener for `eventName`, dispatch a
 *   message event whose `data` carries the call arguments;
 * - otherwise fall back to calling the corresponding global function
 *   (`globalThis.renderPage` / `globalThis.updatePage`) directly.
 *
 * The fallback is what keeps existing ReactLynx bundles — which export
 * `globalThis.renderPage` and never touch `lynx.getEngine()` — working
 * unchanged.
 *
 * `args` is passed as an array, matching the engine, which packs `args...`
 * into a `lepus::CArray`.
 *
 * @returns `true` when the event channel was used, `false` when `directCall`
 * ran. Returned for observability (tests, tracing); callers may ignore it.
 */
export function dispatchEngineEventWithFallback(
  engineContext: LynxEngineContext,
  eventName: string,
  directCall: () => void,
  args: unknown[],
): boolean {
  if (engineContext.hasEventListener(eventName)) {
    engineContext.dispatchEvent({
      type: eventName,
      data: args as Cloneable,
    });
    return true;
  }
  directCall();
  return false;
}
