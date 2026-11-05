// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, vi } from 'vitest';

import { injectGlobals } from './mock/globals.js';
import { resetReportErrorState } from './debug/fixtureRunner.ts';
import { registerTemplates } from './debug/registry.ts';
import { installMockNativePapi } from './mock/mockNativePapi.ts';
import { installThreadContexts } from './mock/mockNativePapi/context.ts';
import { checkPerformanceLeaks, resetPerformanceMocks } from './mock/performance.js';

// Vitest evaluates both thread graphs together, including after resetModules.
// Evaluate the real MTS module under MTS flags, as production's DCE entry does.
vi.mock('@lynx-js/lynx-runtime/mts', async importOriginal => {
  const flags = {
    __JS__: globalThis.__JS__,
    __LEPUS__: globalThis.__LEPUS__,
    __MAIN_THREAD__: globalThis.__MAIN_THREAD__,
    __BACKGROUND__: globalThis.__BACKGROUND__,
  };
  Object.assign(globalThis, { __JS__: false, __LEPUS__: true, __MAIN_THREAD__: true, __BACKGROUND__: false });
  try {
    return await importOriginal();
  } finally {
    Object.assign(globalThis, flags);
  }
});

globalThis.__REGISTER_ELEMENT_TEMPLATES__ = registerTemplates;

injectGlobals();

// Initial installation for top-level module evaluation
installMockNativePapi();
installThreadContexts();

const { onMtsDestruction } = await import('../../../src/element-template/native/mts-destroy.ts');

afterEach(async () => {
  // Drain registered lifetimes before resetting reused modules. Tests that keep
  // the same App after its first destruction still need their RL state reset.
  const g = globalThis;

  g.__LEPUS__ = false;
  g.__JS__ = true;
  g.__MAIN_THREAD__ = false;
  g.__BACKGROUND__ = true;

  try {
    const app = g.lynx?.getApp?.();
    if (app?.callDestroyLifetimeFun) {
      app.callDestroyLifetimeFun();
    }
  } finally {
    // Some tests install individual capabilities without evaluating the RL entry.
    // Host destruction alone then has no DSL cleanup listener to invoke.
    const { callDestroyLifetimeFun } = await import('../../../src/element-template/native/callDestroyLifetimeFun.ts');
    callDestroyLifetimeFun();
  }

  g.__LEPUS__ = true;
  g.__JS__ = false;
  g.__MAIN_THREAD__ = true;
  g.__BACKGROUND__ = false;

  try {
    g.lynx?.getNative?.().dispatchEvent?.({ type: '__DestroyLifetime', data: undefined });
    onMtsDestruction();
  } catch {}
});

beforeEach(async () => {
  // Reset reportError state for current test.
  resetReportErrorState();

  // Ensure mocks are installed and fresh for each test
  installMockNativePapi();
  installThreadContexts();

  // Each mock host starts with the same MTS subscriptions as a fresh native context.
  const { injectCalledByNative } = await import('../../../src/element-template/native/main-thread-api.ts');
  injectCalledByNative();

  // Compiled main-thread templates reference `globDynamicComponentEntry`
  // (Element Template always tags template types with it). Real builds define
  // it via the banner/wrapper; reset it here so a fixture that mutates it for a
  // dynamic component does not leak an undefined value into later tests.
  globalThis.globDynamicComponentEntry = '__Card__';

  resetPerformanceMocks();
});

afterEach((context) => {
  const skippedTasks = [
    // Skip preact/debug tests since it would throw errors and abort the rendering process
    'preact/debug',
    'should remove event listener when throw in cleanup',
    'should not throw if error - instead it will render an empty page',
  ];
  if (skippedTasks.some(task => context.task.name.includes(task))) {
    return;
  }

  // check profile call times equal end call times
  checkPerformanceLeaks();

  const reportError = globalThis.lynx?.reportError;
  const globalErrors = globalThis.__LYNX_REPORT_ERROR_CALLS || [];
  const mockCalls = reportError?.mock?.calls || [];
  const totalCalls = mockCalls.length + globalErrors.length;
  if (totalCalls > 0) {
    const fromMock = mockCalls
      .map((args) =>
        args
          .map((arg) => arg instanceof Error ? (arg.stack || arg.message) : JSON.stringify(arg))
          .join(' ')
      )
      .join('\n');
    const fromGlobal = globalErrors
      .map((err) => (err && err.stack) ? err.stack : String(err))
      .join('\n');
    const details = [fromMock, fromGlobal].filter(Boolean).join('\n');

    throw new Error(
      `lynx.reportError was called ${totalCalls} times during test "${context.task.name}".\nDetails:\n${details}`,
    );
  }
});
