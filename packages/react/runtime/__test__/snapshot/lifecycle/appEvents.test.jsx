// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerAppEventHandlers } from '../../../src/core/app-events';

function stubApp({ withCoreContext = true } = {}) {
  const app = {};
  const listeners = {};
  vi.stubGlobal('lynx', {
    getApp: () => app,
    ...(withCoreContext
      ? {
        getCoreContext: () => ({
          addEventListener(type, listener) {
            listeners[type] = listener;
          },
        }),
      }
      : {}),
  });
  return { app, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerAppEventHandlers', () => {
  it('forwards the app-object callbacks to the registered handler', () => {
    const { app } = stubApp();
    const handlers = {
      OnLifecycleEvent: vi.fn(),
      updateGlobalProps: vi.fn(),
      onAppReload: vi.fn(),
      updateCardData: vi.fn(),
      callDestroyLifetimeFun: vi.fn(),
    };

    registerAppEventHandlers(handlers);

    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
    expect(handlers.OnLifecycleEvent).toBeCalledWith(['rLynxFirstScreen', {}]);

    app.updateGlobalProps({ c: 3 });
    expect(handlers.updateGlobalProps).toBeCalledWith({ c: 3 });

    app.onAppReload({ d: 4 });
    expect(handlers.onAppReload).toBeCalledWith({ d: 4 });

    app.updateCardData({ e: 5 });
    expect(handlers.updateCardData).toBeCalledWith({ e: 5 });

    app.callDestroyLifetimeFun();
    expect(handlers.callDestroyLifetimeFun).toBeCalled();

    expect(app.processCardConfig()).toBeUndefined();
  });

  it('delivers element events through the context proxy', () => {
    const { app, listeners } = stubApp();
    const publishEvent = vi.fn();
    const publicComponentEvent = vi.fn();

    registerAppEventHandlers({ publishEvent, publicComponentEvent });

    listeners['__SendPageEvent']({ data: ['', '1:0:', { a: 1 }] });
    expect(publishEvent).toBeCalledWith('1:0:', { a: 1 });

    listeners['__PublishComponentEvent']({ data: ['card', '2:0:', { b: 2 }] });
    expect(publicComponentEvent).toBeCalledWith('card', '2:0:', { b: 2 });

    // The engine turns the same message event into a call on the app object, so
    // carrying them there as well would deliver every event twice.
    expect(app.publishEvent).toBeUndefined();
    expect(app.publicComponentEvent).toBeUndefined();
  });

  it('replaces only the handlers a later registration passes', () => {
    const { app, listeners } = stubApp();
    const first = vi.fn();
    const second = vi.fn();
    const OnLifecycleEvent = vi.fn();

    registerAppEventHandlers({ OnLifecycleEvent, publishEvent: first });
    registerAppEventHandlers({ publishEvent: second });

    listeners['__SendPageEvent']({ data: ['', '1:0:', {}] });
    expect(first).not.toBeCalled();
    expect(second).toBeCalled();

    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
    expect(OnLifecycleEvent).toBeCalled();
  });

  it('keeps each app object on its own handlers', () => {
    const a = vi.fn();
    const b = vi.fn();

    const first = stubApp();
    registerAppEventHandlers({ publishEvent: a });
    const second = stubApp();
    registerAppEventHandlers({ publishEvent: b });

    first.listeners['__SendPageEvent']({ data: ['', '1:0:', {}] });
    expect(a).toBeCalled();
    expect(b).not.toBeCalled();

    second.listeners['__SendPageEvent']({ data: ['', '1:0:', {}] });
    expect(b).toBeCalled();
  });

  it('tolerates a callback with no handler registered', () => {
    const { app, listeners } = stubApp();
    registerAppEventHandlers({});

    expect(() => {
      app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
      app.updateGlobalProps({});
      app.onAppReload({});
      app.updateCardData({});
      app.callDestroyLifetimeFun();
      listeners['__SendPageEvent']({ data: ['', '1:0:', {}] });
      listeners['__PublishComponentEvent']({ data: ['card', '2:0:', {}] });
    }).not.toThrow();
  });

  it('skips the subscriptions on an engine without context proxies', () => {
    const { app, listeners } = stubApp({ withCoreContext: false });

    registerAppEventHandlers({ publishEvent: vi.fn() });

    expect(Object.keys(listeners)).toHaveLength(0);
    expect(app.OnLifecycleEvent).toBeTypeOf('function');
  });
});
