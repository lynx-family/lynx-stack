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

type EngineEventListener<TData> = (event: EngineMessageEvent<TData>) => void;
type ListenerRegistration = {
  wrapper: EventListener;
  detachAbort?: () => void;
};
type ListenerLedger<TData> = Map<
  string,
  Map<EngineEventListener<TData>, ListenerRegistration>
>;

let EngineEvent: (new(type: string, data: unknown) => Event) | undefined;

function engineEvent(type: string, data: unknown): Event {
  // MessageEvent would coerce undefined to null.
  EngineEvent ??= class extends Event {
    readonly data: unknown;
    constructor(type: string, data: unknown) {
      super(type);
      this.data = data;
    }
  };
  return new EngineEvent(type, data);
}

function captureOf(
  options?: boolean | AddEventListenerOptions | EventListenerOptions,
): boolean {
  return typeof options === 'boolean' ? options : options?.capture === true;
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
export class LynxEngineContextImpl<TData = Cloneable[] | undefined>
  extends EventTarget
  implements LynxEngineContext<TData>
{
  // EventTarget matches registrations by type, listener and capture flag.
  #bubbling: ListenerLedger<TData> = new Map();
  #capturing: ListenerLedger<TData> = new Map();

  #disposed = false;

  // @ts-expect-error the listener receives the `{ type, data }` view of the
  // dispatched event, which is narrower than DOM `EventListener`.
  override addEventListener(
    type: string,
    listener: EngineEventListener<TData>,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (typeof listener !== 'function' || this.#disposed) return;
    const signal = typeof options === 'object' ? options.signal : undefined;
    if (signal?.aborted) return;
    const capture = captureOf(options);
    const ledger = capture ? this.#capturing : this.#bubbling;
    const bucket = ledger.get(type) ?? new Map();
    // A duplicate add keeps the first registration's options.
    if (bucket.has(listener)) return;

    const once = typeof options === 'object' && options.once === true;
    const wrapper = ((event: Event) => {
      // `EventTarget` unregisters a `once` listener *before* invoking it, so
      // the ledger can settle up here rather than trying to predict from the
      // outside which registrations a dispatch consumed. Doing it first also
      // means a handler that re-arms itself (`addEventListener(type, self,
      // { once: true })` from inside its own call) re-enters the ledger after
      // this removal and is correctly kept.
      if (once) this.#forget(ledger, type, listener);
      try {
        listener(event as unknown as EngineMessageEvent<TData>);
      } catch (e) {
        // Report and carry on, so one broken card callback cannot stop the
        // remaining listeners — or, on the `__DestroyLifetime` path, abort
        // teardown and leak the worker. `EventTarget` would otherwise hand the
        // throw to the host's "report an exception" step, which a bare jsdom
        // realm discards silently.
        console.error(`[lynx-web] error in engine "${type}" listener`, e);
      }
    }) as EventListener;
    super.addEventListener(type, wrapper, options);
    const registration: ListenerRegistration = { wrapper };
    if (signal) {
      const onAbort = () => {
        if (ledger.get(type)?.get(listener)?.wrapper === wrapper) {
          this.#forget(ledger, type, listener);
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      registration.detachAbort = () =>
        signal.removeEventListener('abort', onAbort);
    }
    bucket.set(listener, registration);
    ledger.set(type, bucket);
  }

  // @ts-expect-error see `addEventListener`.
  override removeEventListener(
    type: string,
    listener: EngineEventListener<TData>,
    options?: boolean | EventListenerOptions,
  ): void {
    if (typeof listener !== 'function') return;
    const capture = captureOf(options);
    const ledger = capture ? this.#capturing : this.#bubbling;
    const registration = this.#forget(ledger, type, listener);
    if (registration) {
      super.removeEventListener(type, registration.wrapper, capture);
    }
  }

  #forget(
    ledger: ListenerLedger<TData>,
    type: string,
    listener: EngineEventListener<TData>,
  ): ListenerRegistration | undefined {
    const bucket = ledger.get(type);
    const registration = bucket?.get(listener);
    if (bucket && registration) {
      registration.detachAbort?.();
      bucket.delete(listener);
      if (bucket.size === 0) ledger.delete(type);
    }
    return registration;
  }

  /**
   * Whether at least one listener is registered for `type`, regardless of its
   * capture flag. This is the web counterpart of
   * `ContextProxy::HasEventListener`, which the engine consults to choose
   * between the event channel and the legacy direct call.
   */
  hasEventListener(type: string): boolean {
    return this.#capturing.has(type) || this.#bubbling.has(type);
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
  override dispatchEvent(event: EngineMessageEvent<TData>): number {
    if (this.#disposed) return DispatchEventResult.NotCanceled;
    // `once` bookkeeping is settled by the wrapper itself, as `EventTarget`
    // invokes it, so nothing has to be reconciled around this call.
    super.dispatchEvent(engineEvent(event.type, event.data));
    return DispatchEventResult.NotCanceled;
  }

  /** Detach listeners and their abort subscriptions after teardown. */
  dispose(): void {
    this.#disposed = true;
    for (const capture of [false, true]) {
      const ledger = capture ? this.#capturing : this.#bubbling;
      for (const [type, bucket] of ledger) {
        for (const { wrapper, detachAbort } of bucket.values()) {
          detachAbort?.();
          super.removeEventListener(type, wrapper, capture);
        }
      }
      ledger.clear();
    }
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
 * `createArgs` packs the positional arguments into an array only when an
 * Engine listener will receive them.
 *
 * @returns `true` when the event channel was used, `false` when `directCall`
 * ran. Returned for observability (tests, tracing); callers may ignore it.
 */
export function dispatchEngineEventWithFallback(
  engineContext: LynxEngineContext,
  eventName: string,
  directCall: () => void,
  createArgs: () => unknown[],
): boolean {
  if (engineContext.hasEventListener(eventName)) {
    engineContext.dispatchEvent({
      type: eventName,
      data: createArgs() as Cloneable[],
    });
    return true;
  }
  directCall();
  return false;
}
