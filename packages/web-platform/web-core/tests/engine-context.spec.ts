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

  test('event type constants match the C++ SDK', () => {
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
      const received: Event[] = [];
      engine.addEventListener('__RenderPage', (e) => received.push(e));

      const result = engine.dispatchEvent({
        type: '__RenderPage',
        data: [{ hello: 'world' }],
      });

      expect(received).toHaveLength(1);
      const event = received[0] as MessageEvent;
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
      expect((listener.mock.calls[0]![0] as MessageEvent).data).toStrictEqual([
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

      expect((listener.mock.calls[0]![0] as MessageEvent).data).toStrictEqual([
        { data: 1 },
        { processorName: 'p' },
      ]);
    });
  });
});
