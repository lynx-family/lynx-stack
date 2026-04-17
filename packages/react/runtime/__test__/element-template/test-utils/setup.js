// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect } from 'vitest';

import { injectGlobals } from './mock/globals.js';
import { resetReportErrorState } from './debug/fixtureRunner.ts';
import { registerTemplates } from './debug/registry.ts';
import { installMockNativePapi } from './mock/mockNativePapi.ts';
import { installThreadContexts } from './mock/mockNativePapi/context.ts';
import { onMtsDestruction } from '../../../src/element-template/native/mts-destroy.ts';
import { checkPerformanceLeaks, resetPerformanceMocks } from './mock/performance.js';

globalThis.__REGISTER_ELEMENT_TEMPLATES__ = registerTemplates;

injectGlobals();

// Initial installation for top-level module evaluation
installMockNativePapi();
installThreadContexts();

afterEach(() => {
  // Ensure element-template background listeners are always cleaned up
  // (tt.callDestroyLifetimeFun is injected in background thread)
  const g = globalThis;

  g.__LEPUS__ = false;
  g.__JS__ = true;
  g.__MAIN_THREAD__ = false;
  g.__BACKGROUND__ = true;

  try {
    g.lynxCoreInject?.tt?.callDestroyLifetimeFun?.();
  } catch {}

  g.__LEPUS__ = true;
  g.__JS__ = false;
  g.__MAIN_THREAD__ = true;
  g.__BACKGROUND__ = false;

  try {
    onMtsDestruction();
  } catch {}
});

beforeEach(() => {
  // Reset reportError state for current test.
  resetReportErrorState();

  // Ensure mocks are installed and fresh for each test
  installMockNativePapi();
  installThreadContexts();

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
