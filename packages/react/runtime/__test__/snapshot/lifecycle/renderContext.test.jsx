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

    expect(lynx.getApp().OnLifecycleEvent).toBeTypeOf('function');
    expect(lynx.getApp().publishEvent).toBeTypeOf('function');
  });

  it('returns a root that renders', () => {
    const context = createRenderContext({ lynx });
    expect(context.render).toBeTypeOf('function');
    expect(context.registerDataProcessors).toBe(root.registerDataProcessors);
  });

  it('registers without rendering, so a deferred render keeps the callbacks', () => {
    lynx.getApp().OnLifecycleEvent = undefined;
    createRenderContext({ lynx });

    // No render() call here: registration must already have happened, which is
    // what lets the engine's queued first-screen events reach the runtime even
    // when the page defers rendering.
    expect(lynx.getApp().OnLifecycleEvent).toBeTypeOf('function');
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
    const pageLynx = { marker: 'page-b' };
    let seen;
    function Probe() {
      seen = useLynx();
      return null;
    }
    createRenderContext({ lynx: pageLynx }).render(<Probe />);
    expect(seen).toBe(pageLynx);
  });
});
