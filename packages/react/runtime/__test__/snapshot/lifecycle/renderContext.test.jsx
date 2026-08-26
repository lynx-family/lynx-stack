// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';

import { createRenderContext, root, useLynx } from '../../../src/index';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  globalEnvManager.switchToBackground();
});

describe('createRenderContext', () => {
  it('installs the app-level callbacks against the given lynx', () => {
    const app = { name: 'page-a' };
    createRenderContext({ lynx: { getApp: () => app } });

    expect(app.OnLifecycleEvent).toBeTypeOf('function');
    expect(app.__reactHandlers).toBeTypeOf('object');
  });

  it('gives each page its own callbacks', () => {
    const appA = { name: 'page-a' };
    const appB = { name: 'page-b' };
    createRenderContext({ lynx: { getApp: () => appA } });
    createRenderContext({ lynx: { getApp: () => appB } });

    expect(appA.__reactHandlers).not.toBe(appB.__reactHandlers);
    expect(appB.OnLifecycleEvent).toBeTypeOf('function');
  });

  it('returns a root that renders', () => {
    const context = createRenderContext({ lynx });
    expect(context.render).toBeTypeOf('function');
    expect(context.registerDataProcessors).toBe(root.registerDataProcessors);
  });

  it('registers without rendering, so a deferred render keeps the callbacks', () => {
    createRenderContext({ lynx });

    // No render() call here: registration must already have happened, which is
    // what lets the engine's queued first-screen events reach the runtime even
    // when the page defers rendering.
    expect(lynx.getApp().__reactHandlers?.OnLifecycleEvent).toBeTypeOf('function');
    expect(lynx.getApp().__reactHandlers?.publishEvent).toBeTypeOf('function');
  });
});

describe('useLynx', () => {
  it('falls back to the module-scope lynx outside a render context', () => {
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    root.render(<Probe />);
    expect(seen).toBe(lynx);
  });

  it('resolves to the lynx of the page rendering it', () => {
    const pageLynx = { marker: 'page-b', getApp: () => ({}) };
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    createRenderContext({ lynx: pageLynx }).render(<Probe />);
    expect(seen).toBe(pageLynx);
  });
});
