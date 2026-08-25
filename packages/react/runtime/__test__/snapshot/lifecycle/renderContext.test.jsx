// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRenderContext, root, useLynx } from '../../../src/index';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  globalEnvManager.switchToBackground();
});

function stubPage() {
  const app = {};
  const proxy = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const core = proxy();
  const native = proxy();
  return { app, core, native, pageLynx: { getApp: () => app, getCoreContext: () => core, getNative: () => native } };
}

describe('createRenderContext', () => {
  it('subscribes on the context proxies of the given lynx', () => {
    const page = stubPage();
    createRenderContext({ lynx: page.pageLynx });

    expect(page.core.addEventListener).toBeCalledWith(
      '__SendPageEvent',
      expect.any(Function),
    );
    expect(page.native.addEventListener).toBeCalledWith(
      '__DestroyLifetime',
      expect.any(Function),
    );
  });

  it('gives each page its own handlers', () => {
    const a = stubPage();
    const b = stubPage();
    createRenderContext({ lynx: a.pageLynx });
    createRenderContext({ lynx: b.pageLynx });

    expect(a.app.__reactHandlers).not.toBe(b.app.__reactHandlers);
    expect(b.core.addEventListener).toBeCalled();
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
    const pageLynx = { marker: 'page-b', ...stubPage().pageLynx };
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    createRenderContext({ lynx: pageLynx }).render(<Probe />);
    expect(seen).toBe(pageLynx);
  });
});
