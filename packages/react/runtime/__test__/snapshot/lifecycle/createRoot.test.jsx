// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { root } from '../../../src/index';
import { createRoot, useLynx } from '../../../src/internal';
import { globalEnvManager } from '../utils/envManager';

function stubPage() {
  const app = { _params: { initData: { from: 'page' }, updateData: {} } };
  return { app, pageLynx: { ...lynx, getApp: () => app } };
}

async function importWithSharing() {
  globalThis.__LYNX_GROUP_MODULE_SHARING__ = true;
  vi.resetModules();
  const { createRoot, useLynx } = await import('../../../src/internal');
  return { ...(await import('../../../src/index')), createRoot, useLynx };
}

beforeEach(() => {
  globalEnvManager.switchToBackground();
});

afterEach(() => {
  delete globalThis.__LYNX_GROUP_MODULE_SHARING__;
  vi.resetModules();
});

describe('createRoot', () => {
  it('throws without experimental_lynxGroupModuleSharing', () => {
    expect(() => createRoot(lynx)).toThrow('experimental_lynxGroupModuleSharing');
  });

  it('binds the runtime to the given page', async () => {
    const { createRoot } = await importWithSharing();
    const { app, pageLynx } = stubPage();

    const pageRoot = createRoot(pageLynx);

    expect(pageRoot.render).toBeTypeOf('function');
    expect(app.OnLifecycleEvent).toBeTypeOf('function');
    expect(app.publishEvent).toBeTypeOf('function');
    expect(pageLynx.__initData).toEqual({ from: 'page' });
  });

  it('gives each page an independent root', async () => {
    const { createRoot } = await importWithSharing();
    const a = stubPage();
    const b = stubPage();

    const rootA = createRoot(a.pageLynx);
    const rootB = createRoot(b.pageLynx);

    expect(rootA).not.toBe(rootB);
    expect(a.app.OnLifecycleEvent).toBeTypeOf('function');
    expect(b.app.OnLifecycleEvent).toBeTypeOf('function');
    expect(a.app.OnLifecycleEvent).not.toBe(b.app.OnLifecycleEvent);
  });

  it('is required before root.render', async () => {
    const { root } = await importWithSharing();

    expect(() => root.render(null)).toThrow('createRoot(lynx)');
  });
});

describe('useLynx', () => {
  it('falls back to the module-scope lynx without createRoot', () => {
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    root.render(<Probe />);
    expect(seen).toBe(lynx);
  });

  it('resolves to the lynx given to createRoot', async () => {
    const { createRoot, useLynx } = await importWithSharing();
    const { pageLynx } = stubPage();
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    createRoot(pageLynx).render(<Probe />);
    expect(seen).toBe(pageLynx);
  });
});
