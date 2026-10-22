// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe.each(['Snapshot', 'Element Template'])('%s render scheduling', (backend) => {
  let unmount;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('__PROFILE__', false);
    vi.stubGlobal('__ALOG__', false);
    vi.stubGlobal('__MAIN_THREAD__', false);
    vi.stubGlobal('__BACKGROUND__', true);
    vi.stubGlobal('__USE_ELEMENT_TEMPLATE__', backend === 'Element Template');
    unmount = undefined;
  });

  afterEach(async () => {
    unmount?.();
    await Promise.resolve();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function mountCounter() {
    if (backend === 'Snapshot') {
      await import('../../src/lynx.js');
    } else {
      await import('../../src/element-template/native/index.js');
    }
    const { Component, createElement, options, render } = await import('preact');
    const renders = [];
    let counter;

    class Counter extends Component {
      state = { count: 0 };

      render() {
        counter = this;
        renders.push(this.state.count);
        return null;
      }
    }

    const container = options.document.createElement('root');
    render(createElement(Counter), container);
    unmount = () => render(null, container);
    await Promise.resolve();
    return { counter, renders };
  }

  it('batches state updates through lynx.queueMicrotask with its receiver intact', async () => {
    const nativeQueue = vi.fn(function(callback) {
      expect(this).toBe(nativeLynx);
      return Promise.resolve().then(callback);
    });
    const nativeLynx = { ...lynx, queueMicrotask: nativeQueue };
    const globalQueue = vi.fn(callback => Promise.resolve().then(callback));
    vi.stubGlobal('lynx', nativeLynx);
    vi.stubGlobal('queueMicrotask', globalQueue);
    const { counter, renders } = await mountCounter();
    nativeQueue.mockClear();

    counter.setState(({ count }) => ({ count: count + 1 }));
    counter.setState(({ count }) => ({ count: count + 1 }));

    expect(renders).toEqual([0]);
    expect(nativeQueue).toHaveBeenCalledTimes(1);
    expect(globalQueue).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(renders).toEqual([0, 2]);
  });

  it('batches state updates through Promise when lynx.queueMicrotask is unavailable', async () => {
    vi.stubGlobal('lynx', { ...lynx, queueMicrotask: undefined });
    const globalQueue = vi.fn(callback => Promise.resolve().then(callback));
    vi.stubGlobal('queueMicrotask', globalQueue);
    const { counter, renders } = await mountCounter();

    counter.setState(({ count }) => ({ count: count + 1 }));
    counter.setState(({ count }) => ({ count: count + 1 }));

    expect(renders).toEqual([0]);
    expect(globalQueue).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(renders).toEqual([0, 2]);
  });
});
