// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerAppEventHandlers } from '../../../src/core/app-events';

function stubApp() {
  const app = {};
  vi.stubGlobal('lynx', { getApp: () => app });
  return app;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerAppEventHandlers', () => {
  it('forwards every app-level callback to the registered handler', () => {
    const app = stubApp();
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

    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
    expect(handlers.OnLifecycleEvent).toBeCalledWith(['rLynxFirstScreen', {}]);

    app.publishEvent('1:0:', { a: 1 });
    expect(handlers.publishEvent).toBeCalledWith('1:0:', { a: 1 });

    app.publicComponentEvent('card', '2:0:', { b: 2 });
    expect(handlers.publicComponentEvent).toBeCalledWith('card', '2:0:', {
      b: 2,
    });

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

  it('replaces only the handlers a later registration passes', () => {
    const app = stubApp();
    const first = vi.fn();
    const second = vi.fn();
    const OnLifecycleEvent = vi.fn();

    registerAppEventHandlers({ OnLifecycleEvent, publishEvent: first });
    registerAppEventHandlers({ publishEvent: second });

    app.publishEvent('1:0:', {});
    expect(first).not.toBeCalled();
    expect(second).toBeCalled();

    app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
    expect(OnLifecycleEvent).toBeCalled();
  });

  it('keeps each app object on its own handlers', () => {
    const appA = stubApp();
    const a = vi.fn();
    registerAppEventHandlers({ publishEvent: a });

    const appB = stubApp();
    const b = vi.fn();
    registerAppEventHandlers({ publishEvent: b });

    appA.publishEvent('1:0:', {});
    expect(a).toBeCalled();
    expect(b).not.toBeCalled();

    appB.publishEvent('1:0:', {});
    expect(b).toBeCalled();
  });

  it('tolerates a callback with no handler registered', () => {
    const app = stubApp();
    registerAppEventHandlers({});

    expect(() => {
      app.OnLifecycleEvent(['rLynxFirstScreen', {}]);
      app.publishEvent('1:0:', {});
      app.publicComponentEvent('card', '2:0:', {});
      app.updateGlobalProps({});
      app.onAppReload({});
      app.updateCardData({});
      app.callDestroyLifetimeFun();
    }).not.toThrow();
  });
});
