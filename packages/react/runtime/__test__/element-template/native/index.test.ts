import { afterEach, beforeEach, describe, expect, it, rstest as vi, rstest } from '@rstest/core';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('element-template native index wiring', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    rstest.resetModules();
    vi.clearAllMocks();
    globalThis.__ALOG_ELEMENT_API__ = undefined;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    globalThis.__ALOG_ELEMENT_API__ = undefined;
    rstest.resetModules();
    rstest.doUnmock('../../../src/element-template/native/main-thread-api.js');
    rstest.doUnmock('../../../src/element-template/native/patch-listener.js');
    rstest.doUnmock('../../../src/element-template/native/mts-destroy.js');
    rstest.doUnmock('../../../src/element-template/native/callDestroyLifetimeFun.js');
    rstest.doUnmock('../../../src/element-template/native/reload-background.js');
    rstest.doUnmock('../../../src/element-template/prop-adapters/event.js');
    rstest.doUnmock('../../../src/element-template/background/document.js');
    rstest.doUnmock('../../../src/element-template/background/hydration-listener.js');
    rstest.doUnmock('../../../src/element-template/background/commit-hook.js');
    rstest.doUnmock('../../../src/element-template/background/instance.js');
    rstest.doUnmock('../../../src/element-template/debug/elementPAPICall.js');
    rstest.doUnmock('../../../src/element-template/debug/profile.js');
    rstest.doUnmock('../../../src/element-template/lynx/env.js');
    rstest.doUnmock('../../../src/element-template/lynx/performance.js');
    rstest.doUnmock('../../../src/core/lynx-update-data.js');
    rstest.doUnmock('../../../src/core/globalProps.js');
    rstest.doUnmock('../../../src/element-template/runtime/page/root-instance.js');
  });

  it('installs main-thread wiring only on main thread', async () => {
    envManager.resetEnv('main');
    globalThis.__ALOG_ELEMENT_API__ = true;

    const injectCalledByNative = vi.fn();
    const installElementTemplatePatchListener = vi.fn();
    const installOnMtsDestruction = vi.fn();
    const initElementTemplatePAPICallAlog = vi.fn();
    const initProfileHook = vi.fn();
    const setupLynxEnv = vi.fn();
    const installElementTemplateCommitHook = vi.fn();
    const setupBackgroundElementTemplateDocument = vi.fn();
    const installElementTemplateHydrationListener = vi.fn();
    const setRoot = vi.fn();
    const initTimingAPI = vi.fn();
    const reloadBackground = vi.fn();

    rstest.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    rstest.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    rstest.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    rstest.doMock('../../../src/element-template/debug/elementPAPICall.js', () => ({
      initElementTemplatePAPICallAlog,
    }));
    rstest.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    rstest.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    rstest.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    rstest.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    rstest.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    rstest.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    rstest.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    rstest.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {},
    }));
    rstest.doMock('../../../src/element-template/native/reload-background.js', () => ({
      reloadBackground,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(initElementTemplatePAPICallAlog).toHaveBeenCalledTimes(1);
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
    const publishEvent = vi.fn();
    const publicComponentEvent = vi.fn();
    const resetEventStateForRuntime = vi.fn();
    const updateCardData = vi.fn();
    const updateGlobalProps = vi.fn();
    const reloadBackground = vi.fn();

    rstest.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    rstest.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    rstest.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    rstest.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    rstest.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    rstest.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    rstest.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    rstest.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    rstest.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    rstest.doMock('../../../src/core/lynx-update-data.js', () => ({
      updateCardData,
    }));
    rstest.doMock('../../../src/core/globalProps.js', () => ({
      updateGlobalProps,
    }));
    rstest.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    rstest.doMock('../../../src/element-template/native/callDestroyLifetimeFun.js', () => ({
      callDestroyLifetimeFun,
    }));
    rstest.doMock('../../../src/element-template/prop-adapters/event.js', () => ({
      publishEvent,
      publicComponentEvent,
      resetEventStateForRuntime,
    }));
    rstest.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {
        constructor(public type: string) {}
      },
    }));
    rstest.doMock('../../../src/element-template/native/reload-background.js', () => ({
      reloadBackground,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(setRoot).toHaveBeenCalledTimes(1);
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(installElementTemplateCommitHook).toHaveBeenCalledTimes(1);
    expect(initTimingAPI).toHaveBeenCalledTimes(1);
    expect(initProfileHook).toHaveBeenCalledTimes(1);
    expect(setupLynxEnv).toHaveBeenCalledTimes(1);
    expect(resetEventStateForRuntime).toHaveBeenCalledTimes(1);
    expect(globalThis.lynxCoreInject.tt.callDestroyLifetimeFun).toBe(callDestroyLifetimeFun);
    expect(globalThis.lynxCoreInject.tt.publishEvent).toBe(publishEvent);
    expect(globalThis.lynxCoreInject.tt.publicComponentEvent).toBe(publicComponentEvent);
    expect(globalThis.lynxCoreInject.tt.updateGlobalProps).toEqual(expect.any(Function));
    expect(globalThis.lynxCoreInject.tt.updateCardData).toBe(updateCardData);
    expect(globalThis.lynxCoreInject.tt.onAppReload).toBe(reloadBackground);

    globalThis.lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
    expect(updateGlobalProps).toHaveBeenCalledWith(
      { theme: 'light' },
      { forceRerender: expect.any(Function) },
    );

    expect(injectCalledByNative).not.toHaveBeenCalled();
    expect(installElementTemplatePatchListener).not.toHaveBeenCalled();
    expect(installOnMtsDestruction).not.toHaveBeenCalled();
  });
});
