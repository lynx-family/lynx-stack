// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppEvents, registerAppEventHandlers, unregisterAppEventHandlers } from '../../../src/core/app-events';

/** A proxy that records listeners and can dispatch to them, like the engine. */
function stubProxy() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((type, listener) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    }),
    removeEventListener: vi.fn((type, listener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter(l => l !== listener));
    }),
    emit: (type, data) => {
      for (const listener of listeners.get(type) ?? []) listener({ data });
    },
    count: (type) => (listeners.get(type) ?? []).length,
  };
}

function stubPage() {
  const lifecycleListeners = [];
  const app = {
    addLifecycleEventListener: vi.fn((listener) => {
      lifecycleListeners.push(listener);
      return () => {
        lifecycleListeners.splice(lifecycleListeners.indexOf(listener), 1);
      };
    }),
    emitLifecycle: (args) => lifecycleListeners.forEach((l) => l(args)),
    lifecycleCount: () => lifecycleListeners.length,
  };
  const core = stubProxy();
  const native = stubProxy();
  const pageLynx = {
    getApp: () => app,
    getCoreContext: () => core,
    getNative: () => native,
  };
  vi.stubGlobal('lynx', pageLynx);
  return { app, core, native, pageLynx };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerAppEventHandlers', () => {
  it('routes every app-level event to the registered handler', () => {
    const { app, core, native } = stubPage();
    const handlers = {
      OnLifecycleEvent: vi.fn(),
      publishEvent: vi.fn(),
      publicComponentEvent: vi.fn(),
      updateGlobalProps: vi.fn(),
      onAppReload: vi.fn(),
      updateCardData: vi.fn(),
      callDestroyLifetimeFun: vi.fn(),
    };

    registerAppEventHandlers(handlers);

    app.emitLifecycle(['rLynxFirstScreen', {}]);
    expect(handlers.OnLifecycleEvent).toBeCalledWith(['rLynxFirstScreen', {}]);

    core.emit(AppEvents.pageEvent, ['', '1:0:', { a: 1 }]);
    expect(handlers.publishEvent).toBeCalledWith('1:0:', { a: 1 });

    core.emit(AppEvents.componentEvent, ['card', '2:0:', { b: 2 }]);
    expect(handlers.publicComponentEvent).toBeCalledWith('card', '2:0:', { b: 2 });

    core.emit(AppEvents.globalProps, [{ c: 3 }]);
    expect(handlers.updateGlobalProps).toBeCalledWith({ c: 3 });

    core.emit(AppEvents.cardData, [{ d: 4 }, undefined]);
    expect(handlers.updateCardData).toBeCalledWith({ d: 4 }, undefined);

    core.emit(AppEvents.appReload, [{ e: 5 }]);
    expect(handlers.onAppReload).toBeCalledWith({ e: 5 });

    native.emit(AppEvents.destroy, undefined);
    expect(handlers.callDestroyLifetimeFun).toBeCalled();
  });

  it('replaces only the handlers a later registration passes', () => {
    const { app, core } = stubPage();
    const first = { publishEvent: vi.fn(), OnLifecycleEvent: vi.fn() };
    registerAppEventHandlers(first);

    const second = { publishEvent: vi.fn() };
    registerAppEventHandlers(second);

    core.emit(AppEvents.pageEvent, ['', '1:0:', {}]);
    expect(second.publishEvent).toBeCalled();
    expect(first.publishEvent).not.toBeCalled();

    app.emitLifecycle(['x', {}]);
    expect(first.OnLifecycleEvent).toBeCalled();
  });

  it('subscribes once however often handlers are registered', () => {
    const { core } = stubPage();

    registerAppEventHandlers({ publishEvent: vi.fn() });
    registerAppEventHandlers({ publishEvent: vi.fn() });

    expect(core.count(AppEvents.pageEvent)).toBe(1);
  });

  it('keeps each page on its own subscription', () => {
    const a = stubPage();
    const aHandler = vi.fn();
    registerAppEventHandlers({ publishEvent: aHandler }, a.pageLynx);

    const b = stubPage();
    const bHandler = vi.fn();
    registerAppEventHandlers({ publishEvent: bHandler }, b.pageLynx);

    a.core.emit(AppEvents.pageEvent, ['', '1:0:', {}]);
    expect(aHandler).toBeCalled();
    expect(bHandler).not.toBeCalled();
  });

  it('tolerates an event with no handler registered', () => {
    const { core } = stubPage();
    registerAppEventHandlers({});

    expect(() => core.emit(AppEvents.pageEvent, ['', '1:0:', {}])).not.toThrow();
  });

  it('runs the app hook before a page event reaches its handler', () => {
    const { app, core } = stubPage();
    const order = [];
    app.callBeforePublishEvent = vi.fn(() => order.push('hook'));
    registerAppEventHandlers({ publishEvent: () => order.push('handler') });

    core.emit(AppEvents.pageEvent, ['', '1:0:', { a: 1 }]);

    expect(app.callBeforePublishEvent).toBeCalledWith({ a: 1 });
    expect(order).toEqual(['hook', 'handler']);
  });

  it('falls back to the app method when lynx-core cannot replay', () => {
    const { app, pageLynx } = stubPage();
    delete app.addLifecycleEventListener;
    const OnLifecycleEvent = vi.fn();

    registerAppEventHandlers({ OnLifecycleEvent }, pageLynx);
    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);

    expect(OnLifecycleEvent).toBeCalledWith(['rLynxFirstScreen', {}]);

    unregisterAppEventHandlers(pageLynx);
    expect(app.OnLifecycleEvent).toBeUndefined();
  });

  it('skips a runtime that has no context proxies of its own', () => {
    const app = {};
    const standalone = { getApp: () => app };

    const OnLifecycleEvent = vi.fn();
    const handlers = {
      OnLifecycleEvent,
      publishEvent: vi.fn(),
      publicComponentEvent: vi.fn(),
      updateGlobalProps: vi.fn(),
      updateCardData: vi.fn(),
      onAppReload: vi.fn(),
      callDestroyLifetimeFun: vi.fn(),
    };
    registerAppEventHandlers(handlers, standalone);

    // No proxies, so the host's method calls carry every callback.
    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
    expect(OnLifecycleEvent).toBeCalledWith(['rLynxFirstScreen', {}]);

    app.publishEvent('1:0:', { a: 1 });
    expect(handlers.publishEvent).toBeCalledWith('1:0:', { a: 1 });
    app.publicComponentEvent('card', '2:0:', { b: 2 });
    expect(handlers.publicComponentEvent).toBeCalledWith('card', '2:0:', { b: 2 });
    app.updateGlobalProps({ c: 3 });
    expect(handlers.updateGlobalProps).toBeCalledWith({ c: 3 });
    app.updateCardData({ d: 4 });
    expect(handlers.updateCardData).toBeCalledWith({ d: 4 });
    app.onAppReload({ e: 5 });
    expect(handlers.onAppReload).toBeCalledWith({ e: 5 });
    app.callDestroyLifetimeFun();
    expect(handlers.callDestroyLifetimeFun).toBeCalled();
    expect(() => app.processCardConfig()).not.toThrow();

    unregisterAppEventHandlers(standalone);
    expect(app.OnLifecycleEvent).toBeUndefined();
  });

  it('upgrades from the methods to subscriptions once proxies appear', () => {
    const app = {};
    const core = stubProxy();
    const native = stubProxy();
    const early = { getApp: () => app };
    const later = { getApp: () => app, getCoreContext: () => core, getNative: () => native };
    const publishEvent = vi.fn();

    // Registered before the page has its proxies: the methods carry the events.
    registerAppEventHandlers({ publishEvent }, early);
    expect(typeof app.publishEvent).toBe('function');
    expect(core.count(AppEvents.pageEvent)).toBe(0);

    registerAppEventHandlers({ publishEvent }, later);

    expect(app.publishEvent).toBeUndefined();
    expect(core.count(AppEvents.pageEvent)).toBe(1);
    core.emit(AppEvents.pageEvent, ['', '1:0:', { a: 1 }]);
    expect(publishEvent).toBeCalledWith('1:0:', { a: 1 });
  });

  it('drops the subscription on unregister', () => {
    const { core, pageLynx } = stubPage();
    const publishEvent = vi.fn();
    registerAppEventHandlers({ publishEvent }, pageLynx);

    unregisterAppEventHandlers(pageLynx);

    expect(core.count(AppEvents.pageEvent)).toBe(0);
    core.emit(AppEvents.pageEvent, ['', '1:0:', {}]);
    expect(publishEvent).not.toBeCalled();
  });
});
