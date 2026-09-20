// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useState } from 'preact/hooks';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { root } from '../../../src/lynx-api';
import { installComponentCompat } from '../../../src/core/component';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';
import { isRendering } from '../../../src/snapshot/lifecycle/isRendering';

beforeAll(() => {
  installComponentCompat();
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('isRendering in background', () => {
  it.each(['renderComponent', '__'])('forwards %s before entering the render scope', async key => {
    vi.resetModules();
    const { Component, createElement, options } = await import('preact');
    const previousHooks = { __: options.__, renderComponent: options.renderComponent };
    onTestFinished(() => {
      Object.assign(options, previousHooks);
      vi.resetModules();
    });
    const failure = new Error('predecessor failed');
    const oldHook = vi.fn(() => {
      expect(scope.isRendering.value).toBe(false);
    });
    options[key] = oldHook;
    const scope = await import('../../../src/snapshot/lifecycle/isRendering');
    const vnode = createElement('view', {});
    const second = key === 'renderComponent' ? new Component({}) : document.createElement('root');
    options[key](vnode, second);
    expect(oldHook.mock.calls).toEqual([[vnode, second]]);
    expect(oldHook.mock.contexts).toEqual([undefined]);
    expect(scope.isRendering.value).toBe(true);
    await Promise.resolve();
    expect(scope.isRendering.value).toBe(false);
    oldHook.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() => options[key](vnode, second)).toThrow(failure);
    expect(scope.isRendering.value).toBe(false);
  });

  it('should set isRendering to true during initial rendering and false after', async () => {
    let isRenderingValue = false;

    function Comp() {
      isRenderingValue = isRendering.value;
      return <text>{`Hello World`}</text>;
    }

    globalEnvManager.switchToBackground();
    root.render(<Comp />);
    expect(__root.__firstChild.__firstChild.__values).toEqual(['Hello World']);
    expect(isRenderingValue).toBe(true);
    expect(isRendering.value).toBe(false);
  });

  it('should set isRendering to false when error is thrown', async () => {
    let isRenderingValue = false;

    function Comp() {
      isRenderingValue = isRendering.value;
      throw new Error('render error');
      return <text>Hello</text>;
    }

    try {
      root.render(<Comp />);
    } catch (e) {
      // ignore
    }
    await waitSchedule();
    expect(isRenderingValue).toBe(true);
    expect(isRendering.value).toBe(false);
  });

  it('should set isRendering to true during update and false after', async () => {
    let isRenderingValue = false;
    let update;

    function Comp() {
      const [text, setText] = useState('Hello');
      update = setText;
      isRenderingValue = isRendering.value;
      return <text>{text}</text>;
    }

    root.render(<Comp />);
    expect(isRenderingValue).toBe(true); // initial render
    expect(isRendering.value).toBe(false);

    isRenderingValue = false;
    update('World');
    await waitSchedule();
    expect(isRenderingValue).toBe(true); // update
    expect(isRendering.value).toBe(false);
    expect(__root.__firstChild.__firstChild.__values).toEqual(['World']);
  });

  it('should set isRendering to true during reload and false after', async () => {
    let isRenderingValue = false;

    function Comp() {
      isRenderingValue = isRendering.value;
      return <text>{lynx.__initData.text}</text>;
    }

    globalEnvManager.switchToBackground();
    root.render(<Comp />);
    expect(isRenderingValue).toBe(true);
    await waitSchedule();
    expect(isRendering.value).toBe(false);

    isRenderingValue = false;
    lynx.getApp().onAppReload({ text: 'World' });
    await waitSchedule();
    expect(isRenderingValue).toBe(true);
    expect(isRendering.value).toBe(false);
    expect(__root.__firstChild.__firstChild.__values).toEqual(['World']);
  });
});
