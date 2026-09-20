// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, it, onTestFinished, vi } from 'vitest';

import { RENDER_COMPONENT, ROOT } from '../../src/shared/render-constants.js';

it.each([RENDER_COMPONENT, ROOT] as const)('forwards %s after starting update timing', async key => {
  vi.resetModules();
  const { Component, createElement, options } = await import('preact');
  const previousHooks = { [ROOT]: options[ROOT], [RENDER_COMPONENT]: options[RENDER_COMPONENT] };
  onTestFinished(() => {
    Object.assign(options, previousHooks);
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  vi.stubGlobal('__JS__', true);
  const events: string[] = [];
  const failure = new Error('predecessor failed');
  const oldHook = vi.fn(() => {
    events.push('predecessor');
    throw failure;
  });
  options[key] = oldHook;
  const { initTimingAPI } = await import('../../src/core/performance.js');
  initTimingAPI({
    shouldStartUpdatePipeline: () => true,
    beginPipeline: () => {
      events.push('timing');
    },
  });
  const installedHook = options[key];
  initTimingAPI({
    shouldStartUpdatePipeline: () => true,
    beginPipeline: () => {
      events.push('replacement timing');
    },
  });
  expect(options[key]).toBe(installedHook);

  const vnode = createElement('view', {});
  const component = new Component({});
  const parent = document.createElement('root');
  if (key === RENDER_COMPONENT) {
    expect(() => options[RENDER_COMPONENT]!(vnode, component)).toThrow(failure);
    expect(oldHook.mock.calls[0]).toEqual([vnode, component]);
  } else {
    expect(() => options[ROOT]!(vnode, parent)).toThrow(failure);
    expect(oldHook.mock.calls[0]).toEqual([vnode, parent]);
  }
  expect(oldHook.mock.contexts).toEqual([undefined]);
  expect(events).toEqual(['replacement timing', 'predecessor']);
});
