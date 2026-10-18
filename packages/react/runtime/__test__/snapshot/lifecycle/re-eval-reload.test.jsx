/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerDestroyTask } from '../../../src/core/runtime-destroy';
import { __root, setRoot } from '../../../src/root';
import { completeMainThreadReload } from '../../../src/snapshot/lifecycle/reload';
import { SnapshotInstance } from '../../../src/snapshot/snapshot/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

const supportsReEvalKey = Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__');
const reloaderKey = Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');
const completerKey = Symbol.for('__LYNX_MAIN_THREAD_RELOAD_COMPLETER__');

function App({ label = 'app' }) {
  return (
    <view>
      <text>{label}</text>
    </view>
  );
}

describe('re-evaluating the main-thread entry on reload', () => {
  beforeEach(() => {
    globalEnvManager.resetEnv();
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    globalEnvManager.switchToMainThread();
    lynx[supportsReEvalKey] = true;
  });

  afterEach(() => {
    delete lynx[supportsReEvalKey];
    delete lynx[reloaderKey];
    delete lynx[completerKey];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalEnvManager.resetEnv();
    elementTree.clear();
  });

  it('retires the entry, evaluates it again and lets it hydrate the existing tree', () => {
    __root.__jsx = <App label='old' />;
    renderPage({ kept: 'yes', count: 1 });
    const page = __root.__element_root;
    const events = [];
    registerDestroyTask(() => events.push('retire'));
    lynx[reloaderKey] = () => {
      events.push('evaluate');
      // What evaluating the entry does: reset init data, install its completer, render into a fresh root.
      lynx.__initData = {};
      lynx[completerKey] = completeMainThreadReload;
      setRoot(new SnapshotInstance('root'));
      __root.__jsx = <App label='new' />;
    };
    const createText = vi.spyOn(globalThis, '__CreateText');

    updatePage({ count: 2 }, { reloadTemplate: true });

    expect(events).toEqual(['retire', 'evaluate']);
    expect(lynx.__initData).toEqual({ kept: 'yes', count: 2 });
    expect(__root.__element_root).toBe(page);
    expect(createText).not.toHaveBeenCalled();
    expect(JSON.stringify(page)).toContain('new');
    expect(JSON.stringify(page)).not.toContain('old');
  });
});

describe('re-evaluating the background entry on reload', () => {
  let reloadCard;

  beforeEach(() => {
    globalEnvManager.resetEnv();
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    globalEnvManager.switchToBackground();
    lynx[supportsReEvalKey] = true;
    reloadCard = vi.fn();
    lynx.getApp().reloadCard = reloadCard;
    lynx.__globalProps = {};
    __root.__jsx = <App />;
    render(<App />, __root);
  });

  afterEach(() => {
    delete lynx[supportsReEvalKey];
    delete lynx.getApp().reloadCard;
    vi.unstubAllGlobals();
    globalEnvManager.resetEnv();
    elementTree.clear();
  });

  it('retires the entry, then asks the client to evaluate it with the merged data', () => {
    lynx.__initData = { kept: 'yes', count: 1 };
    const destroy = vi.spyOn(lynx.getApp(), 'callDestroyLifetimeFun');

    lynx.getApp().onAppReload({ count: 2 }, { source: 'test' });

    expect(reloadCard).toHaveBeenCalledWith({ kept: 'yes', count: 2 }, { source: 'test' });
    expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(reloadCard.mock.invocationCallOrder[0]);
    expect(__root.childNodes).toEqual([]);
  });

  it('does not render the old tree again from a globalProps update queued before the reload', async () => {
    lynx.getApp().updateGlobalProps({ theme: 'dark' });
    lynx.getApp().onAppReload({});
    await Promise.resolve();

    expect(__root.childNodes).toEqual([]);
  });
});
