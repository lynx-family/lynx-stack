// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoot } from '../../../src/internal';
import { globalEnvManager } from '../utils/envManager';

function stubPage() {
  const app = { _params: { initData: { from: 'page' }, updateData: {} } };
  return { app, pageLynx: { ...lynx, getApp: () => app } };
}

async function importWithSharing() {
  globalThis.__LYNX_GROUP_MODULE_SHARING__ = true;
  vi.resetModules();
  const { createRoot } = await import('../../../src/internal');
  return { ...(await import('../../../src/index')), createRoot };
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

  it('can be called only once', async () => {
    const { createRoot } = await importWithSharing();
    createRoot(stubPage().pageLynx);

    expect(() => createRoot(stubPage().pageLynx)).toThrow('only once');
  });

  it('is required before root.render', async () => {
    const { root } = await importWithSharing();

    expect(() => root.render(null)).toThrow('createRoot(lynx)');
  });
});
