// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RootContext, defaultRootContext, getCurrentRootContext, switchRootContext } from '../../src/render-context';
import {
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from '../../src/snapshot/lifecycle/patch/snapshotPatch';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { backgroundSnapshotInstanceManager } from '../../src/snapshot';
import { COMMIT } from '../../src/shared/render-constants';
import { BackgroundSnapshotInstance } from '../../src/snapshot/snapshot/backgroundSnapshot';
import { globalEnvManager } from './utils/envManager';

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  switchRootContext(defaultRootContext);
  vi.restoreAllMocks();
});

describe('switchRootContext', () => {
  it('routes per-render singletons to the current context and refreshes read aliases', () => {
    const a = new RootContext();
    const b = new RootContext();

    switchRootContext(a);
    initGlobalSnapshotPatch();
    __globalSnapshotPatch.push(['A']);

    switchRootContext(b);
    initGlobalSnapshotPatch();
    __globalSnapshotPatch.push(['B']);

    switchRootContext(a);
    expect(__globalSnapshotPatch).toEqual([['A']]);
    switchRootContext(b);
    expect(__globalSnapshotPatch).toEqual([['B']]);

    expect(a.snapshotPatch).toEqual([['A']]);
    expect(b.snapshotPatch).toEqual([['B']]);
  });

  it('takeGlobalSnapshotPatch only drains the current context', () => {
    const a = new RootContext();
    const b = new RootContext();

    switchRootContext(a);
    initGlobalSnapshotPatch();
    __globalSnapshotPatch.push(['A']);
    switchRootContext(b);
    initGlobalSnapshotPatch();
    __globalSnapshotPatch.push(['B']);

    switchRootContext(a);
    expect(takeGlobalSnapshotPatch()).toEqual([['A']]);
    expect(b.snapshotPatch).toEqual([['B']]);
  });

  it('is a no-op when switching to the current context', () => {
    const a = new RootContext();
    switchRootContext(a);
    const refresher = vi.fn();
    expect(getCurrentRootContext()).toBe(a);
    switchRootContext(a);
    expect(getCurrentRootContext()).toBe(a);
    expect(refresher).not.toHaveBeenCalled();
  });
});

describe('per-root background snapshot instances', () => {
  it('registers each instance in its owner context and tears down only that owner', () => {
    const a = new RootContext();
    const b = new RootContext();

    switchRootContext(a);
    const nodeA = new BackgroundSnapshotInstance('root');
    switchRootContext(b);
    const nodeB = new BackgroundSnapshotInstance('root');

    expect(a.bsiValues.has(nodeA.__id)).toBe(true);
    expect(b.bsiValues.has(nodeA.__id)).toBe(false);
    expect(b.bsiValues.has(nodeB.__id)).toBe(true);
    expect(a.bsiValues.has(nodeB.__id)).toBe(false);

    expect(nodeA.__id).not.toBe(nodeB.__id);

    switchRootContext(a);
    nodeB.tearDown();
    expect(a.bsiValues.has(nodeA.__id)).toBe(true);
    expect(b.bsiValues.has(nodeB.__id)).toBe(false);
  });

  it('manager.values follows the current context', () => {
    const a = new RootContext();
    switchRootContext(a);
    const nodeA = new BackgroundSnapshotInstance('root');
    expect(backgroundSnapshotInstanceManager.values.has(nodeA.__id)).toBe(true);

    switchRootContext(defaultRootContext);
    expect(backgroundSnapshotInstanceManager.values.has(nodeA.__id)).toBe(false);
  });
});

describe('commit callbacks', () => {
  it('run the commit task of the context that sent the patch', () => {
    globalEnvManager.switchToBackground();
    replaceCommitHook();
    const commitInContext = () => {
      const ctx = new RootContext();
      let onPatchApplied;
      ctx.lynx = {
        ...lynx,
        getNativeApp: () => ({
          ...lynx.getNativeApp(),
          callLepusMethod: (_name, _data, callback) => {
            onPatchApplied = callback;
          },
        }),
      };
      switchRootContext(ctx);
      initGlobalSnapshotPatch();
      options[COMMIT]({}, []);
      return { ctx, onPatchApplied: () => onPatchApplied() };
    };

    const a = commitInContext();
    const b = commitInContext();
    expect(a.ctx.commitTaskMap.size).toBe(1);
    expect(b.ctx.commitTaskMap.size).toBe(1);

    a.onPatchApplied();
    expect(a.ctx.commitTaskMap.size).toBe(0);
    expect(b.ctx.commitTaskMap.size).toBe(1);
  });
});

async function importWithSharing() {
  globalThis.__LYNX_GROUP_MODULE_SHARING__ = true;
  vi.resetModules();
  return import('../../src/internal');
}

function stubPage(from) {
  const emitter = { emit() {} };
  const app = { _params: { initData: { from }, updateData: {} }, GlobalEventEmitter: emitter };
  return {
    app,
    pageLynx: {
      ...lynx,
      __globalProps: {},
      __initData: undefined,
      getApp: () => app,
    },
  };
}

describe('createRoot app callbacks', () => {
  afterEach(() => {
    delete globalThis.__LYNX_GROUP_MODULE_SHARING__;
    vi.resetModules();
  });

  it('switches to the owning page context when a bound callback runs', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const rc = await import('../../src/render-context');
    const { getPageLynx } = await import('../../src/core/page-lynx');

    const a = stubPage('A');
    const b = stubPage('B');
    createRoot(a.pageLynx);
    createRoot(b.pageLynx);

    rc.switchRootContext(rc.defaultRootContext);
    let lynxDuringA;
    a.app.GlobalEventEmitter.emit = () => {
      lynxDuringA = getPageLynx();
    };
    a.app.updateGlobalProps({ k: 1 }, {});
    expect(lynxDuringA).toBe(a.pageLynx);

    rc.switchRootContext(rc.defaultRootContext);
    let lynxDuringB;
    b.app.GlobalEventEmitter.emit = () => {
      lynxDuringB = getPageLynx();
    };
    b.app.updateGlobalProps({ k: 2 }, {});
    expect(lynxDuringB).toBe(b.pageLynx);

    expect(a.pageLynx.__globalProps).toEqual({ k: 1 });
    expect(b.pageLynx.__globalProps).toEqual({ k: 2 });
  });

  it('runs each page\'s effects against its own lynx', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { useEffect } = await import('../../src/index');
    const { getPageLynx } = await import('../../src/core/page-lynx');

    const lynxInEffect = {};
    const lynxInCleanup = {};
    const Page = ({ name }) => {
      useEffect(() => {
        lynxInEffect[name] = getPageLynx();
        if (name === 'A') {
          return () => {
            lynxInCleanup[name] = getPageLynx();
          };
        }
      }, []);
      return null;
    };
    const a = stubPage('A');
    const b = stubPage('B');
    const rootA = createRoot(a.pageLynx);
    const rootB = createRoot(b.pageLynx);
    rootA.render(<Page name='A' />);
    rootB.render(<Page name='B' />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lynxInEffect.A).toBe(a.pageLynx);
    expect(lynxInEffect.B).toBe(b.pageLynx);

    rootA.render(null);
    rootB.render(<Page name='B' />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lynxInCleanup.A).toBe(a.pageLynx);
  });

  it('installs the lazy bundle loader on each page\'s lynx', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { loadLazyBundle } = await import('../../src/core/lynx/lazy-bundle');

    const a = stubPage('A');
    const b = stubPage('B');
    delete a.pageLynx.loadLazyBundle;
    delete b.pageLynx.loadLazyBundle;
    createRoot(a.pageLynx);
    createRoot(b.pageLynx);

    expect(a.pageLynx.loadLazyBundle).toBe(loadLazyBundle);
    expect(b.pageLynx.loadLazyBundle).toBe(loadLazyBundle);
  });

  it('re-renders the page whose globalProps changed', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const rc = await import('../../src/render-context');

    const renders = { A: 0, B: 0 };
    const Page = ({ name }) => {
      renders[name]++;
      return null;
    };
    const a = stubPage('A');
    const b = stubPage('B');
    const rootA = createRoot(a.pageLynx);
    const rootB = createRoot(b.pageLynx);
    rootA.render(<Page name='A' />);
    rootB.render(<Page name='B' />);
    renders.A = renders.B = 0;

    a.app.updateGlobalProps({ k: 1 });
    rc.switchRootContext(rc.defaultRootContext);
    await Promise.resolve();

    expect(renders).toEqual({ A: 1, B: 0 });
  });
});
