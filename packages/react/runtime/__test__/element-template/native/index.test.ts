import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('element-template native index wiring', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    vi.resetModules();
    vi.doUnmock('../../../src/element-template/native/main-thread-api.js');
    vi.doUnmock('../../../src/element-template/native/patch-listener.js');
    vi.doUnmock('../../../src/element-template/native/mts-destroy.js');
    vi.doUnmock('../../../src/element-template/native/callDestroyLifetimeFun.js');
    vi.doUnmock('../../../src/element-template/background/document.js');
    vi.doUnmock('../../../src/element-template/background/hydration-listener.js');
    vi.doUnmock('../../../src/element-template/background/commit-hook.js');
    vi.doUnmock('../../../src/element-template/background/instance.js');
    vi.doUnmock('../../../src/element-template/debug/profile.js');
    vi.doUnmock('../../../src/element-template/lynx/env.js');
    vi.doUnmock('../../../src/element-template/lynx/performance.js');
    vi.doUnmock('../../../src/element-template/runtime/page/root-instance.js');
  });

  it('installs main-thread wiring only on main thread', async () => {
    envManager.resetEnv('main');

    const injectCalledByNative = vi.fn();
    const installElementTemplatePatchListener = vi.fn();
    const installOnMtsDestruction = vi.fn();
    const initProfileHook = vi.fn();
    const setupLynxEnv = vi.fn();
    const installElementTemplateCommitHook = vi.fn();
    const setupBackgroundElementTemplateDocument = vi.fn();
    const installElementTemplateHydrationListener = vi.fn();
    const setRoot = vi.fn();
    const initTimingAPI = vi.fn();

    vi.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    vi.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    vi.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    vi.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    vi.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    vi.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    vi.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    vi.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    vi.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    vi.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    vi.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {},
    }));

    await import('../../../src/element-template/native/index.js');

    expect(injectCalledByNative).toHaveBeenCalledTimes(1);
    expect(installElementTemplatePatchListener).toHaveBeenCalledTimes(1);
    expect(installOnMtsDestruction).toHaveBeenCalledTimes(1);
    expect(initProfileHook).toHaveBeenCalledTimes(1);
    expect(setupLynxEnv).toHaveBeenCalledTimes(1);

    expect(installElementTemplateCommitHook).not.toHaveBeenCalled();
    expect(setupBackgroundElementTemplateDocument).not.toHaveBeenCalled();
    expect(installElementTemplateHydrationListener).not.toHaveBeenCalled();
    expect(setRoot).not.toHaveBeenCalled();
    expect(initTimingAPI).not.toHaveBeenCalled();
  });

  it('installs background wiring only on background thread', async () => {
    envManager.resetEnv('background');
    process.env['NODE_ENV'] = 'production';
    globalThis.lynx.performance.isProfileRecording = vi.fn(() => true);

    const injectCalledByNative = vi.fn();
    const installElementTemplatePatchListener = vi.fn();
    const installOnMtsDestruction = vi.fn();
    const installElementTemplateCommitHook = vi.fn();
    const setupBackgroundElementTemplateDocument = vi.fn();
    const installElementTemplateHydrationListener = vi.fn();
    const initProfileHook = vi.fn();
    const setupLynxEnv = vi.fn();
    const initTimingAPI = vi.fn();
    const setRoot = vi.fn();
    const callDestroyLifetimeFun = vi.fn();

    vi.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    vi.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    vi.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    vi.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    vi.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    vi.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    vi.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    vi.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    vi.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    vi.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    vi.doMock('../../../src/element-template/native/callDestroyLifetimeFun.js', () => ({
      callDestroyLifetimeFun,
    }));
    vi.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {
        constructor(public type: string) {}
      },
    }));

    await import('../../../src/element-template/native/index.js');

    expect(setRoot).toHaveBeenCalledTimes(1);
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(installElementTemplateCommitHook).toHaveBeenCalledTimes(1);
    expect(initTimingAPI).toHaveBeenCalledTimes(1);
    expect(initProfileHook).toHaveBeenCalledTimes(1);
    expect(setupLynxEnv).toHaveBeenCalledTimes(1);
    expect(globalThis.lynxCoreInject.tt.callDestroyLifetimeFun).toBe(callDestroyLifetimeFun);

    expect(injectCalledByNative).not.toHaveBeenCalled();
    expect(installElementTemplatePatchListener).not.toHaveBeenCalled();
    expect(installOnMtsDestruction).not.toHaveBeenCalled();
  });
});
