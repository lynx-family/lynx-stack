/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  Cloneable,
  EngineMessageEvent,
  LynxEngineContext,
} from '../../types/index.js';
import { DispatchEventResult } from '../LynxCrossThreadContext.js';

type EngineEventListener = (event: EngineMessageEvent) => void;

function captureOf(
  options?: boolean | AddEventListenerOptions | EventListenerOptions,
): boolean {
  return typeof options === 'boolean' ? options : options?.capture === true;
}

/**
 * Ledger key. `capture` is part of listener identity for `EventTarget` — the
 * same callback added once capturing and once bubbling is two registrations —
 * so it is part of the key too.
 */
function ledgerKey(type: string, capture: boolean): string {
  return `${capture ? 'C' : 'B'}\u0000${type}`;
}

/** An `Event` carrying the engine's `data` payload. See {@link engineEvent}. */
interface EngineEventCtor {
  new(type: string, data: Cloneable[] | undefined): Event;
}
let EngineEvent: EngineEventCtor | undefined;

/**
 * Build the object handed to `super.dispatchEvent`.
 *
 * `EventTarget` only accepts a real `Event`, so the engine's `{ type, data }`
 * has to travel as one. It is deliberately an `Event` subclass rather than a
 * `MessageEvent`: `new MessageEvent(type, { data: undefined })` coerces `data`
 * to `null`, whereas the engine uses `undefined` to mark an event that carries
 * no packed arguments (`__DestroyLifetime`), and the public
 * `EngineMessageEvent.data` type admits no `null`. Subclassing also keeps the
 * event in the same realm as the `Event` this class was defined against, which
 * `dispatchEvent` brand-checks.
 *
 * The class is built on first use because `Event` is not guaranteed to exist
 * when this module is evaluated.
 */
function engineEvent(type: string, data: Cloneable[] | undefined): Event {
  EngineEvent ??= class extends Event {
    readonly data: Cloneable[] | undefined;
    constructor(eventType: string, eventData: Cloneable[] | undefined) {
      super(eventType);
      this.data = eventData;
    }
  };
  return new EngineEvent(type, data);
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
 * Registration identity, invocation order, `once` and duplicate-add semantics
 * are delegated to `EventTarget`, exactly as `LynxCrossThreadContext` does for
 * `lynx.getJSContext()`, so the two contexts a card can reach behave alike.
 * Listeners receive an event whose `type` and `data` mirror the engine, where
 * `LepusClosureEventListener::ConvertEventToLepusValue` reads those same two
 * fields off the event before handing them to lepus.
 *
 * Unlike the JS context there is no RPC hop: the engine and the main-thread
 * script share a thread, so `dispatchEvent` delivers synchronously.
 */
export class LynxEngineContextImpl extends EventTarget
  implements LynxEngineContext
{
  /**
   * Mirror of what has been handed to `EventTarget`, keyed by
   * {@link ledgerKey} and mapping each card callback to the wrapper actually
   * registered for it.
   *
   * `EventTarget` exposes no way to ask whether a type has listeners, and the
   * engine needs exactly that to choose between the event channel and the
   * legacy direct call. The ledger answers {@link hasEventListener} and holds
   * the wrappers needed to unregister; it never decides ordering or delivery.
   * Empty buckets are dropped, so a bucket's presence is itself the answer.
   */
  #ledger: Map<string, Map<EngineEventListener, EventListener>> = new Map();

  #disposed = false;

  // @ts-expect-error the listener receives the `{ type, data }` view of the
  // dispatched `MessageEvent`, which is narrower than DOM `EventListener`.
  override addEventListener(
    type: string,
    listener: EngineEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (typeof listener !== 'function' || this.#disposed) return;
    const capture = captureOf(options);
    const key = ledgerKey(type, capture);
    let bucket = this.#ledger.get(key);
    if (!bucket) {
      bucket = new Map();
      this.#ledger.set(key, bucket);
    }
    if (bucket.has(listener)) {
      // `EventTarget` ignores a repeated (type, listener, capture) triple and
      // keeps the first registration's options. Returning here keeps that
      // no-op exact: re-registering the same wrapper would be ignored anyway,
      // but building a *new* wrapper would read as a distinct listener and be
      // invoked a second time.
      return;
    }
    const once = typeof options === 'object' && options.once === true;
    const wrapper = ((event: Event) => {
      // `EventTarget` unregisters a `once` listener *before* invoking it, so
      // the ledger can settle up here rather than trying to predict from the
      // outside which registrations a dispatch consumed. Doing it first also
      // means a handler that re-arms itself (`addEventListener(type, self,
      // { once: true })` from inside its own call) re-enters the ledger after
      // this removal and is correctly kept.
      if (once) this.#forget(key, listener);
      try {
        listener(event as unknown as EngineMessageEvent);
      } catch (e) {
        // Report and carry on, so one broken card callback cannot stop the
        // remaining listeners — or, on the `__DestroyLifetime` path, abort
        // teardown and leak the worker. `EventTarget` would otherwise hand the
        // throw to the host's "report an exception" step, which a bare jsdom
        // realm discards silently.
        console.error(`[lynx-web] error in engine "${type}" listener`, e);
      }
    }) as EventListener;
    bucket.set(listener, wrapper);
    super.addEventListener(type, wrapper, options);
  }

  // @ts-expect-error see `addEventListener`.
  override removeEventListener(
    type: string,
    listener: EngineEventListener,
    options?: boolean | EventListenerOptions,
  ): void {
    if (typeof listener !== 'function') return;
    const capture = captureOf(options);
    const wrapper = this.#forget(ledgerKey(type, capture), listener);
    if (wrapper) super.removeEventListener(type, wrapper, capture);
  }

  /** Drop `listener` from the ledger, returning the wrapper to unregister. */
  #forget(
    key: string,
    listener: EngineEventListener,
  ): EventListener | undefined {
    const bucket = this.#ledger.get(key);
    if (!bucket) return undefined;
    const wrapper = bucket.get(listener);
    if (bucket.delete(listener) && bucket.size === 0) {
      this.#ledger.delete(key);
    }
    return wrapper;
  }

  /**
   * Whether at least one listener is registered for `type`, regardless of its
   * capture flag. This is the web counterpart of
   * `ContextProxy::HasEventListener`, which the engine consults to choose
   * between the event channel and the legacy direct call.
   */
  hasEventListener(type: string): boolean {
    return this.#ledger.has(ledgerKey(type, true))
      || this.#ledger.has(ledgerKey(type, false));
  }

  /**
   * Dispatch an engine message event to the main-thread script.
   *
   * Accepts the `{ type, data }` shape used by `LynxCrossThreadContext` so card
   * code can dispatch onto the engine proxy with the same call shape it uses
   * for `lynx.getJSContext()`. Listeners run synchronously.
   */
  // @ts-expect-error the engine dispatches the `{ type, data }` shape and reads
  // back a `DispatchEventResult`, not the DOM `boolean`.
  override dispatchEvent(event: EngineMessageEvent): number {
    if (this.#disposed) return DispatchEventResult.NotCanceled;
    // `once` bookkeeping is settled by the wrapper itself, as `EventTarget`
    // invokes it, so nothing has to be reconciled around this call.
    super.dispatchEvent(engineEvent(event.type, event.data));
    return DispatchEventResult.NotCanceled;
  }

  /**
   * Stop delivering events. Called on teardown *after* `__DestroyLifetime` has
   * been delivered.
   *
   * Listeners are not individually unregistered. This proxy is owned by the
   * `LynxViewInstance` being destroyed — its only construction site — so once
   * that instance is unreachable the proxy and every listener it holds are
   * collected together. Clearing the ledger and refusing further dispatch is
   * the part callers can observe.
   */
  dispose(): void {
    this.#disposed = true;
    this.#ledger.clear();
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
 * into a `lepus::CArray`. Events dispatched outside this helper - such as
 * `__DestroyLifetime`, a bare teardown signal - carry no arguments and so do
 * not use the array shape.
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
      data: args as Cloneable[],
    });
    return true;
  }
  directCall();
  return false;
}
