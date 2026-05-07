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
  globalThis.globDynamicComponentEntry = '__Card__';
  globalThis.lynxCoreInject = {};
  globalThis.lynxCoreInject.tt = {};

  installPerformanceGlobals();

  globalThis.requestAnimationFrame = setTimeout;
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis._ReportError = vi.fn();

  console.alog = vi.fn();
}
