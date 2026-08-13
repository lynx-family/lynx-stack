// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, process } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { installComponentCompat } from '../../src/core/component';
import { useState } from '../../src/index';
import { root } from '../../src/lynx-api';
import { __root } from '../../src/root';
import { defaultRootContext, switchRootContext } from '../../src/root-context';
import { ReactLynxRoot } from '../../src/multi-root-render-context';
import '../../src/multi-root-render-context';
import { backgroundSnapshotInstanceManager, setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { initGlobalSnapshotPatch } from '../../src/snapshot/lifecycle/patch/snapshotPatch';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';

beforeAll(() => {
  installComponentCompat();
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

// Reads back the text value rendered into a container's first <text>.
function textOf(container) {
  return container.__firstChild.__firstChild.__values;
}

describe('root-cause: default singleton shares one container', () => {
  it('a second root.render into the singleton replaces the first tree', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    const B = () => <text>{'B'}</text>;

    root.render(<A />);
    expect(textOf(__root)).toEqual(['A']);

    // The default `root` is bound to the module-level `__root`; rendering another
    // app clobbers the previous tree instead of coexisting with it.
    root.render(<B />);
    expect(textOf(__root)).toEqual(['B']);
  });
});

describe('bootstrap hook: classic root.render renders the bootstrapped page', () => {
  afterEach(() => {
    root.__experimentalBindRenderContext();
  });

  it('is a no-op on the main thread', () => {
    const prev = globalThis.__BACKGROUND__;
    globalThis.__BACKGROUND__ = false;
    try {
      expect(root.__experimentalBindRenderContext({})).toBeUndefined();
    } finally {
      globalThis.__BACKGROUND__ = prev;
    }
  });

  it('delegates root.render to the bootstrapped root, leaving __root untouched', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    const pageA = root.__experimentalBindRenderContext({});
    root.render(<A />);

    expect(textOf(pageA._container)).toEqual(['A']);
    expect(__root.__firstChild).toBeNull();
  });

  it('a second card bootstrap does not clobber the first card tree', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    const B = () => <text>{'B'}</text>;

    const pageA = root.__experimentalBindRenderContext({});
    root.render(<A />);
    const pageB = root.__experimentalBindRenderContext({});
    root.render(<B />);

    expect(pageA._container).not.toBe(pageB._container);
    expect(textOf(pageA._container)).toEqual(['A']);
    expect(textOf(pageB._container)).toEqual(['B']);
  });

  it('clearing the binding restores the classic singleton path', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    root.__experimentalBindRenderContext({});
    root.__experimentalBindRenderContext();
    root.render(<A />);

    expect(textOf(__root)).toEqual(['A']);
  });

  it('does the first-screen handshake through the bootstrapped card channel', () => {
    globalEnvManager.switchToBackground();

    const callA = vi.fn((_name, _data, cb) => cb?.());
    const lynxA = {
      ...lynx,
      getNativeApp: () => ({ ...lynx.getNativeApp(), callLepusMethod: callA }),
    };

    const old = globalThis.__FIRST_SCREEN_SYNC_TIMING__;
    try {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
      root.__experimentalBindRenderContext({ lynx: lynxA });
      root.render(<text>{'A'}</text>);
      const handshakes = callA.mock.calls.filter(c => c[0] === 'rLynxFirstScreenSyncReady');
      expect(handshakes).toHaveLength(1);
    } finally {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = old;
    }
  });
});

describe('ReactLynxRoot: independent roots coexist', () => {
  it('renders two roots into isolated containers without clobbering', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    const B = () => <text>{'B'}</text>;

    const rootA = new ReactLynxRoot();
    const rootB = new ReactLynxRoot();

    rootA.render(<A />);
    rootB.render(<B />);

    // Each root keeps its own container; neither overwrites the other, and
    // neither touches the default module-level `__root`.
    expect(rootA._container).not.toBe(rootB._container);
    expect(textOf(rootA._container)).toEqual(['A']);
    expect(textOf(rootB._container)).toEqual(['B']);
    expect(__root.__firstChild).toBeNull();
  });

  it('isolates component state between roots', () => {
    globalEnvManager.switchToBackground();

    let bumpA;
    class Counter extends Component {
      state = { n: 0 };
      render() {
        bumpA ??= () => this.setState(s => ({ n: s.n + 1 }));
        return <text>{this.state.n}</text>;
      }
    }

    const rootA = new ReactLynxRoot();
    const rootB = new ReactLynxRoot();
    rootA.render(<Counter />);
    rootB.render(<Counter />);

    expect(textOf(rootA._container)).toEqual([0]);
    expect(textOf(rootB._container)).toEqual([0]);

    // Bumping rootA's counter must not leak into rootB.
    bumpA();
    process();
    expect(textOf(rootA._container)).toEqual([1]);
    expect(textOf(rootB._container)).toEqual([0]);
  });

  it('unmount tears down the container tree (background)', () => {
    globalEnvManager.switchToBackground();

    const A = () => <text>{'A'}</text>;
    const r = new ReactLynxRoot();
    r.render(<A />);
    expect(textOf(r._container)).toEqual(['A']);

    r.unmount();
    expect(r._container.__firstChild).toBeNull();
    expect(r._container.__jsx).toBeUndefined();
  });

  it('keeps two roots patch streams separate (no merged rLynxChange)', () => {
    globalEnvManager.switchToBackground();

    let bumpA, bumpB;
    function A() {
      const [n, set] = useState(0);
      bumpA = () => set(v => v + 1);
      return <text>{n}</text>;
    }
    function B() {
      const [n, set] = useState(0);
      bumpB = () => set(v => v + 1);
      return <text>{n}</text>;
    }

    const rootA = new ReactLynxRoot();
    const rootB = new ReactLynxRoot();
    rootA.render(<A />);
    rootB.render(<B />);

    // Mark both roots hydrated so their updates start producing patches.
    switchRootContext(rootA._ctx);
    initGlobalSnapshotPatch();
    switchRootContext(rootB._ctx);
    initGlobalSnapshotPatch();
    switchRootContext(defaultRootContext);

    const idA = rootA._container.__firstChild.__firstChild.__id;
    const idB = rootB._container.__firstChild.__firstChild.__id;

    lynx.getNativeApp().callLepusMethod.mockClear();
    // Both roots update in the same Preact flush; the renderComponent hook
    // re-establishes each owner context, so each commit takes only its own
    // root's patch buffer.
    bumpA();
    bumpB();
    process();

    const calls = lynx.getNativeApp().callLepusMethod.mock.calls.filter(c => c[0] === 'rLynxChange');
    expect(calls).toHaveLength(2);
    const patches = calls.map(c => JSON.parse(c[1].data).patchList[0].snapshotPatch);
    // SetAttribute is [3, id, dynamicPartIndex, value]; each patch stream
    // holds exactly its own root's op — never the other root's.
    expect(patches[0]).toEqual([3, idA, 0, 1]);
    expect(patches[1]).toEqual([3, idB, 0, 1]);
  });

  it('sends a channel-bound root patches only through its own lynx', () => {
    globalEnvManager.switchToBackground();

    const callC = vi.fn((_name, _data, cb) => cb?.());
    const lynxC = {
      ...lynx,
      getNativeApp: () => ({ ...lynx.getNativeApp(), callLepusMethod: callC }),
    };

    let bumpC;
    function C() {
      const [n, set] = useState(0);
      bumpC = () => set(v => v + 1);
      return <text>{n}</text>;
    }

    const rootC = new ReactLynxRoot({ lynx: lynxC });
    rootC.render(<C />);

    switchRootContext(rootC._ctx);
    initGlobalSnapshotPatch();
    switchRootContext(defaultRootContext);

    lynx.getNativeApp().callLepusMethod.mockClear();
    bumpC();
    process();

    // The patch goes through this root's own channel; the ambient global
    // channel stays silent.
    const callsC = callC.mock.calls.filter(c => c[0] === 'rLynxChange');
    expect(callsC).toHaveLength(1);
    expect(lynx.getNativeApp().callLepusMethod).not.toHaveBeenCalled();
  });

  it('performs the first-screen handshake through the root own channel', () => {
    globalEnvManager.switchToBackground();

    const callD = vi.fn((_name, _data, cb) => cb?.());
    const lynxD = {
      ...lynx,
      getNativeApp: () => ({ ...lynx.getNativeApp(), callLepusMethod: callD }),
    };

    const old = globalThis.__FIRST_SCREEN_SYNC_TIMING__;
    try {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
      const rootD = new ReactLynxRoot({ lynx: lynxD });
      rootD.render(<text>{'D'}</text>);
      expect(callD.mock.calls.map(c => c[0])).toContain('rLynxFirstScreenSyncReady');
      expect(lynx.getNativeApp().callLepusMethod).not.toHaveBeenCalled();
    } finally {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = old;
    }
  });

  it('tears instances down in their owner registry even when another root is current', () => {
    globalEnvManager.switchToBackground();

    const rootA = new ReactLynxRoot();
    rootA.render(<text>{'A'}</text>);
    const instance = rootA._container.__firstChild;
    const id = instance.__id;

    // The default context is current here, but the instance belongs to
    // rootA — teardown (e.g. from a delayed commit task) must remove it from
    // rootA's registry, not the current one's.
    instance.tearDown();

    switchRootContext(rootA._ctx);
    try {
      expect(backgroundSnapshotInstanceManager.values.has(id)).toBe(false);
    } finally {
      switchRootContext(defaultRootContext);
    }
  });

  it('delegates to the default root on the main thread', () => {
    globalEnvManager.switchToMainThread();

    const A = () => <text>{'A'}</text>;
    const jsx = <A />;
    const r = new ReactLynxRoot();
    r.render(jsx);

    // Each card's main-thread VM runs a single root: `renderPage` renders the
    // default `__root.__jsx`, so createRoot delegates to it there — a card's
    // entry can call `new ReactLynxRoot(...).render(...)` on both threads.
    expect(r._container).toBe(__root);
    expect(__root.__jsx).toBe(jsx);
    expect(r._container.__firstChild).toBeNull();

    r.unmount();
    expect(__root.__jsx).toBeUndefined();
  });
});

describe('multi-page: two roots on separate native channels', () => {
  it('hydrates two roots to the same main-thread ids and routes events independently', async () => {
    function App() {
      const [n, set] = useState(0);
      return <text bindtap={() => set(v => v + 1)}>{n}</text>;
    }

    // Main thread: first-screen render of one card. Both cards run the same
    // app, so we replay this one payload into both roots below — exactly the
    // shared-context scenario where per-card main-thread VMs produce
    // overlapping (identical) snapshot ids.
    globalEnvManager.switchToMainThread();
    __root.__jsx = <App />;
    renderPage();
    const firstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
    globalThis.__OnLifecycleEvent.mockClear();

    // Background: card 1 = the default root on the ambient channel.
    globalEnvManager.switchToBackground();
    root.render(<App />);
    lynxCoreInject.tt.OnLifecycleEvent(...firstScreen);
    // `__root` is a live binding aliasing the *current* context's container;
    // capture card 1's container now, while the default context is current.
    const defaultContainer = __root;

    // Card 2 = an independent root bound to its own native bridge objects.
    const ttE = {};
    const callE = vi.fn((_name, _data, cb) => cb?.());
    const lynxE = {
      ...lynx,
      getNativeApp: () => ({ ...lynx.getNativeApp(), callLepusMethod: callE }),
    };
    const rootE = new ReactLynxRoot({ lynx: lynxE, lynxCoreInject: { tt: ttE } });
    expect(typeof ttE.OnLifecycleEvent).toBe('function');
    rootE.render(<App />);
    lynx.getNativeApp().callLepusMethod.mockClear();
    ttE.OnLifecycleEvent(...firstScreen);

    // Hydration patches went through each card's own channel.
    expect(callE.mock.calls.some(c => c[0] === 'rLynxChange')).toBe(true);
    expect(lynx.getNativeApp().callLepusMethod).not.toHaveBeenCalled();

    // Both roots now use the same (main-thread) snapshot ids — the exact
    // collision that a shared instance registry cannot survive.
    const idDefault = defaultContainer.__firstChild.__id;
    const idE = rootE._container.__firstChild.__id;
    expect(idE).toBe(idDefault);
    expect(rootE._container.__firstChild).not.toBe(defaultContainer.__firstChild);

    // An event arriving on card 2's channel taps card 2's handler only.
    callE.mockClear();
    ttE.publishEvent(`${idE}:0:`, {});
    await waitSchedule();
    expect(textOf(rootE._container)).toEqual([1]);
    expect(textOf(defaultContainer)).toEqual([0]);
    // ...and its patch flows back through card 2's channel only.
    const patchesE = callE.mock.calls.filter(c => c[0] === 'rLynxChange');
    expect(patchesE).toHaveLength(1);
    expect(lynx.getNativeApp().callLepusMethod).not.toHaveBeenCalled();

    // The same event signature on card 1's channel taps card 1's handler.
    lynxCoreInject.tt.publishEvent(`${idDefault}:0:`, {});
    await waitSchedule();
    expect(textOf(defaultContainer)).toEqual([1]);
    expect(textOf(rootE._container)).toEqual([1]);
    expect(
      lynx.getNativeApp().callLepusMethod.mock.calls.filter(c => c[0] === 'rLynxChange'),
    ).toHaveLength(1);
  });
});
