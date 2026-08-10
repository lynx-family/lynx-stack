// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import {
  dispatchEngineEventWithFallback,
  LynxEngineContextImpl,
} from '../ts/client/mainthread/LynxEngineContext.js';
import { DispatchEventResult } from '../ts/client/LynxCrossThreadContext.js';
import { EngineMessageEventType } from '../ts/constants.js';
import type { EngineMessageEvent } from '../ts/types/index.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';

// `tests/jsdom.ts` provides `requestAnimationFrame` but not its canceller, and
// `createMainThreadLynx` captures both at module scope.
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  globalThis.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
}

describe('Engine context proxy (lynx.getEngine)', () => {
  let engine: LynxEngineContextImpl;
  beforeEach(() => {
    rstest.resetAllMocks();
    engine = new LynxEngineContextImpl();
  });

  test('event type constants match the engine', () => {
    // core/runtime/js/runtime_constant.h
    expect(EngineMessageEventType.RenderPage).toBe('__RenderPage');
    expect(EngineMessageEventType.UpdatePage).toBe('__UpdatePage');
    expect(EngineMessageEventType.DestroyLifetime).toBe('__DestroyLifetime');
    expect(EngineMessageEventType.UpdateGlobalProps).toBe(
      '__UpdateGlobalProps',
    );
  });

  test('lynx.getEngine() returns the instance engine context', () => {
    const engineContext = new LynxEngineContextImpl();
    const { lynx } = createMainThreadGlobalAPIs({
      engineContext,
      globalprops: {},
      systemInfo: {},
      templateUrl: 'http://localhost/a.bundle',
      backgroundThread: {
        markTiming: rstest.fn(),
        jsContext: { dispatchEvent: rstest.fn() },
      },
      i18nManager: { _I18nResourceTranslation: rstest.fn() },
    } as unknown as LynxViewInstance);
    expect(lynx.getEngine()).toBe(engineContext);
    // getEngine and getJSContext must be distinct channels
    expect(lynx.getEngine()).not.toBe(lynx.getJSContext());
  });

  describe('addEventListener / removeEventListener / dispatchEvent', () => {
    test('dispatches a MessageEvent carrying type and data', () => {
      const received: EngineMessageEvent[] = [];
      engine.addEventListener('__RenderPage', (e) => received.push(e));

      const result = engine.dispatchEvent({
        type: '__RenderPage',
        data: [{ hello: 'world' }],
      });

      expect(received).toHaveLength(1);
      const event = received[0]!;
      expect(event.type).toBe('__RenderPage');
      expect(event.data).toStrictEqual([{ hello: 'world' }]);
      expect(result).toBe(DispatchEventResult.NotCanceled);
    });

    test('dispatching an unlistened type invokes nothing', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);
      engine.dispatchEvent({ type: '__UpdatePage', data: undefined });
      expect(listener).not.toHaveBeenCalled();
    });

    test('removeEventListener stops delivery', () => {
      const listener = rstest.fn();
      engine.addEventListener('__DestroyLifetime', listener);
      engine.dispatchEvent({
        type: '__DestroyLifetime',
        data: undefined,
      });
      expect(listener).toHaveBeenCalledTimes(1);

      engine.removeEventListener('__DestroyLifetime', listener);
      engine.dispatchEvent({
        type: '__DestroyLifetime',
        data: undefined,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('all four engine event types round-trip', () => {
      const seen: string[] = [];
      for (const type of Object.values(EngineMessageEventType)) {
        engine.addEventListener(type, (e) => seen.push(e.type));
      }
      for (const type of Object.values(EngineMessageEventType)) {
        engine.dispatchEvent({ type, data: undefined });
      }
      expect(seen).toStrictEqual([
        '__RenderPage',
        '__UpdatePage',
        '__DestroyLifetime',
        '__UpdateGlobalProps',
      ]);
    });

    test('supports multiple listeners on the same type', () => {
      const a = rstest.fn();
      const b = rstest.fn();
      engine.addEventListener('__RenderPage', a);
      engine.addEventListener('__RenderPage', b);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    test('once listeners fire a single time', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { once: true });
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('dispatch is synchronous', () => {
      let ran = false;
      engine.addEventListener('__RenderPage', () => {
        ran = true;
      });
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      // no await / microtask needed: the engine and MTS share a thread
      expect(ran).toBe(true);
    });
  });

  describe('hasEventListener', () => {
    test('reflects registration state', () => {
      const listener = rstest.fn();
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.addEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      // unrelated types are unaffected
      expect(engine.hasEventListener('__UpdatePage')).toBe(false);
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });

    test('stays true until the last listener is removed', () => {
      const a = rstest.fn();
      const b = rstest.fn();
      engine.addEventListener('__RenderPage', a);
      engine.addEventListener('__RenderPage', b);
      engine.removeEventListener('__RenderPage', a);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.removeEventListener('__RenderPage', b);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });

    test('deduplicates re-registration of the same listener', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);
      engine.addEventListener('__RenderPage', listener);
      // EventTarget ignores the second add, so a single remove must clear it
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });

    test('tracks capture and bubble registrations separately', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { capture: true });
      engine.addEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      // removing only the bubble registration leaves the capture one
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.removeEventListener('__RenderPage', listener, { capture: true });
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });

    test('removing a never-registered listener does not go negative', () => {
      const listener = rstest.fn();
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.addEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
    });

    test('a once listener stops being reported after it fires', () => {
      engine.addEventListener('__RenderPage', rstest.fn(), { once: true });
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });
  });

  // `hasEventListener` is backed by a ledger kept alongside `EventTarget`'s own
  // registrations, so every case where `EventTarget` does *not* store what a
  // naive counter would assume has to stay in sync. Drift here is worse than a
  // merely wrong boolean: it silently flips the engine between the event
  // channel and the direct `globalThis.renderPage` call.
  describe('ledger parity with EventTarget', () => {
    test('a duplicate add is one registration, cleared by one remove', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);
      engine.addEventListener('__RenderPage', listener);

      // The duplicate add must not register a second time...
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(1);

      // ...so a single remove has to clear the type entirely.
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('capture and bubble are independent registrations of one callback', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { capture: true });
      engine.addEventListener('__RenderPage', listener);

      // Both registrations are live, so the callback runs twice per dispatch.
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(2);

      // Removing the bubble one leaves the capture one behind.
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(3);

      engine.removeEventListener('__RenderPage', listener, { capture: true });
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(3);
    });

    test('a capture flag passed as a boolean is the same registration', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { capture: true });
      // `true` and `{ capture: true }` denote one registration for EventTarget.
      engine.removeEventListener('__RenderPage', listener, true);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).not.toHaveBeenCalled();
    });

    test('removing with a mismatched capture flag removes nothing', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { capture: true });
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('removing one of two distinct callbacks keeps the type reported', () => {
      const a = rstest.fn();
      const b = rstest.fn();
      engine.addEventListener('__RenderPage', a);
      engine.addEventListener('__RenderPage', b);
      engine.removeEventListener('__RenderPage', a);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });

    test('a redundant remove does not corrupt a later add', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);
      engine.removeEventListener('__RenderPage', listener);
      engine.removeEventListener('__RenderPage', listener);
      engine.addEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('a listener added during dispatch survives the dispatch', () => {
      const late = rstest.fn();
      engine.addEventListener('__RenderPage', () => {
        engine.addEventListener('__UpdatePage', late);
      }, { once: true });

      engine.dispatchEvent({ type: '__RenderPage', data: undefined });

      // The spent `once` listener is gone but the newly added one is not.
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      expect(engine.hasEventListener('__UpdatePage')).toBe(true);
      engine.dispatchEvent({ type: '__UpdatePage', data: undefined });
      expect(late).toHaveBeenCalledTimes(1);
    });

    test('a once listener may re-arm itself from inside its handler', () => {
      let calls = 0;
      const handler = () => {
        calls++;
        engine.addEventListener('__UpdatePage', handler, { once: true });
      };
      engine.addEventListener('__UpdatePage', handler, { once: true });

      engine.dispatchEvent({ type: '__UpdatePage', data: undefined });
      // Re-armed, so it must still be reported and must fire again.
      expect(engine.hasEventListener('__UpdatePage')).toBe(true);
      engine.dispatchEvent({ type: '__UpdatePage', data: undefined });
      expect(calls).toBe(2);
      expect(engine.hasEventListener('__UpdatePage')).toBe(true);
    });

    test('a once listener removed before firing is not reported', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener, { once: true });
      engine.removeEventListener('__RenderPage', listener);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).not.toHaveBeenCalled();
    });

    test('one once listener firing does not unregister its siblings', () => {
      const onceFn = rstest.fn();
      const persistent = rstest.fn();
      engine.addEventListener('__RenderPage', onceFn, { once: true });
      engine.addEventListener('__RenderPage', persistent);

      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(engine.hasEventListener('__RenderPage')).toBe(true);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });

      expect(onceFn).toHaveBeenCalledTimes(1);
      expect(persistent).toHaveBeenCalledTimes(2);
    });

    test('a throwing listener still settles the once bookkeeping', () => {
      const consoleError = rstest.spyOn(console, 'error').mockImplementation(
        () => {},
      );
      engine.addEventListener('__RenderPage', () => {
        throw new Error('boom');
      }, { once: true });

      engine.dispatchEvent({ type: '__RenderPage', data: undefined });

      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('a throwing listener does not stop the remaining listeners', () => {
      const consoleError = rstest.spyOn(console, 'error').mockImplementation(
        () => {},
      );
      const after = rstest.fn();
      engine.addEventListener('__RenderPage', () => {
        throw new Error('boom');
      });
      engine.addEventListener('__RenderPage', after);

      engine.dispatchEvent({ type: '__RenderPage', data: undefined });

      expect(after).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('capture listeners run before bubble listeners', () => {
      const order: string[] = [];
      engine.addEventListener('__RenderPage', () => order.push('bubble'));
      engine.addEventListener('__RenderPage', () => order.push('capture'), {
        capture: true,
      });
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(order).toStrictEqual(['capture', 'bubble']);
    });

    test('a non-function listener is ignored rather than reported', () => {
      engine.addEventListener(
        '__RenderPage',
        undefined as unknown as () => void,
      );
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
    });
  });

  // The card-visible event object must keep the `{ type, data }` shape the
  // engine hands lepus, even though it now travels as a real `MessageEvent`.
  describe('event payload shape', () => {
    test('an argument-less event carries undefined, not null', () => {
      // `new MessageEvent(type, { data: undefined })` coerces `data` to `null`;
      // `__DestroyLifetime` is a bare signal and must stay `undefined`.
      let seen: unknown = 'unset';
      engine.addEventListener('__DestroyLifetime', (e) => {
        seen = e.data;
      });
      engine.dispatchEvent({ type: '__DestroyLifetime', data: undefined });
      expect(seen).toBe(undefined);
      expect(seen).not.toBe(null);
    });

    test('packed arguments survive as the same array contents', () => {
      let seen: unknown;
      engine.addEventListener('__UpdatePage', (e) => {
        seen = e.data;
      });
      engine.dispatchEvent({
        type: '__UpdatePage',
        data: [{ a: 1 }, { b: 2 }],
      });
      expect(seen).toStrictEqual([{ a: 1 }, { b: 2 }]);
    });
  });

  describe('dispose', () => {
    test('drops every listener', () => {
      const render = rstest.fn();
      const destroy = rstest.fn();
      engine.addEventListener('__RenderPage', render);
      engine.addEventListener('__DestroyLifetime', destroy, { capture: true });

      engine.dispose();

      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      expect(engine.hasEventListener('__DestroyLifetime')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      engine.dispatchEvent({ type: '__DestroyLifetime', data: undefined });
      expect(render).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
    });

    test('a listener registered after disposal is inert', () => {
      const late = rstest.fn();
      engine.dispose();

      // A card that subscribes during its own teardown must not resurrect the
      // channel, and the engine must stay on the direct-call path.
      engine.addEventListener('__RenderPage', late);
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(late).not.toHaveBeenCalled();

      const directCall = rstest.fn();
      expect(
        dispatchEngineEventWithFallback(engine, '__RenderPage', directCall, []),
      ).toBe(false);
      expect(directCall).toHaveBeenCalledTimes(1);
    });

    test('disposal is idempotent', () => {
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);
      engine.dispose();
      engine.dispose();
      expect(engine.hasEventListener('__RenderPage')).toBe(false);
      engine.dispatchEvent({ type: '__RenderPage', data: undefined });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // The highest-priority behaviour: existing ReactLynx bundles export
  // `globalThis.renderPage` and never touch `lynx.getEngine()`, so the engine
  // must keep calling them directly. Mirrors
  // `TemplateAssembler::DispatchEventFromEngineToCoreContext`.
  describe('fallback semantics', () => {
    test('with a listener: dispatches the event and skips the direct call', () => {
      const directCall = rstest.fn();
      const listener = rstest.fn();
      engine.addEventListener('__RenderPage', listener);

      const usedEventChannel = dispatchEngineEventWithFallback(
        engine,
        '__RenderPage',
        directCall,
        [{ a: 1 }],
      );

      expect(usedEventChannel).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]![0].data).toStrictEqual([
        { a: 1 },
      ]);
      expect(directCall).not.toHaveBeenCalled();
    });

    test('without a listener: calls globalThis.renderPage directly', () => {
      const directCall = rstest.fn();

      const usedEventChannel = dispatchEngineEventWithFallback(
        engine,
        '__RenderPage',
        directCall,
        [{ a: 1 }],
      );

      expect(usedEventChannel).toBe(false);
      expect(directCall).toHaveBeenCalledTimes(1);
    });

    test('a listener on a different type does not divert the direct call', () => {
      const directCall = rstest.fn();
      engine.addEventListener('__UpdatePage', rstest.fn());

      expect(
        dispatchEngineEventWithFallback(
          engine,
          '__RenderPage',
          directCall,
          [],
        ),
      ).toBe(false);
      expect(directCall).toHaveBeenCalledTimes(1);
    });

    test('removing the last listener restores the direct-call path', () => {
      const directCall = rstest.fn();
      const listener = rstest.fn();
      engine.addEventListener('__UpdatePage', listener);

      dispatchEngineEventWithFallback(engine, '__UpdatePage', directCall, []);
      expect(directCall).not.toHaveBeenCalled();

      engine.removeEventListener('__UpdatePage', listener);
      dispatchEngineEventWithFallback(engine, '__UpdatePage', directCall, []);
      expect(directCall).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('positional args are packed into the event data array', () => {
      const listener = rstest.fn();
      engine.addEventListener('__UpdatePage', listener);

      dispatchEngineEventWithFallback(engine, '__UpdatePage', rstest.fn(), [
        { data: 1 },
        { processorName: 'p' },
      ]);

      expect(listener.mock.calls[0]![0].data).toStrictEqual([
        { data: 1 },
        { processorName: 'p' },
      ]);
    });
  });
});
