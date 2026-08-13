// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { vi } from 'vitest';

import { installPerformanceGlobals } from './performance.js';

export function injectGlobals() {
  globalThis.__DEV__ = true;
  globalThis.__PROFILE__ = true;
  globalThis.__ALOG__ = true;
  globalThis.__JS__ = true;
  globalThis.__LEPUS__ = true;
  globalThis.__BACKGROUND__ = true;
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__REF_FIRE_IMMEDIATELY__ = false;
  globalThis.__ENABLE_SSR__ = true;
  globalThis.__USE_ELEMENT_TEMPLATE__ = false;
  globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  globalThis.__EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ = false;
  globalThis.globDynamicComponentEntry = '__Card__';
  globalThis.SystemInfo = {
    lynxSdkVersion: '4.0',
  };
  // Emulates lynx-core's app: the runtime registers handlers through
  // `lynx.registerAppEventHandlers`, and the "engine" (tests) invokes the
  // same-named methods on `lynxCoreInject.tt`, which forward to them —
  // exactly the App-object forwarding the real core performs.
  const appEventHandlers = {};
  globalThis.lynxCoreInject = {};
  globalThis.lynxCoreInject.tt = {
    _params: { initData: {}, updateData: {} },
    OnLifecycleEvent: (...args) => appEventHandlers.onLifecycleEvent?.(...args),
    publishEvent: (...args) => appEventHandlers.publishEvent?.(...args),
    publicComponentEvent: (...args) => appEventHandlers.publicComponentEvent?.(...args),
    updateGlobalProps: (...args) => appEventHandlers.updateGlobalProps?.(...args),
    updateCardData: (...args) => appEventHandlers.updateCardData?.(...args),
    onAppReload: (...args) => appEventHandlers.onAppReload?.(...args),
    callDestroyLifetimeFun: (...args) => appEventHandlers.onDestroyLifetime?.(...args),
  };

  installPerformanceGlobals();

  Object.assign(globalThis.lynx, {
    registerAppEventHandlers: (handlers) => Object.assign(appEventHandlers, handlers),
    getInitDataParams: () => globalThis.lynxCoreInject.tt._params,
    getDynamicComponentExports: (url) => globalThis.lynxCoreInject.tt.getDynamicComponentExports?.(url),
    callBeforePublishEvent: (data) => globalThis.lynxCoreInject.tt.callBeforePublishEvent?.(data),
  });

  globalThis.requestAnimationFrame = setTimeout;
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis._ReportError = vi.fn();

  console.alog = vi.fn();
}
