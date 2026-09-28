// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RootContext, defaultRootContext, getCurrentRootContext, switchRootContext } from '../../src/render-context';
import {
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from '../../src/snapshot/lifecycle/patch/snapshotPatch';
import { backgroundSnapshotInstanceManager } from '../../src/snapshot';
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
});
