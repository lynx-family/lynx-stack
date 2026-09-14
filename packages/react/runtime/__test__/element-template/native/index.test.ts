import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('element-template native index wiring', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    rs.resetModules();
    rs.clearAllMocks();
    globalThis.__ALOG_ELEMENT_API__ = undefined;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    globalThis.__ALOG_ELEMENT_API__ = undefined;
    rs.resetModules();
    rs.doUnmock('../../../src/element-template/native/main-thread-api.js');
    rs.doUnmock('../../../src/element-template/native/patch-listener.js');
    rs.doUnmock('../../../src/element-template/native/mts-destroy.js');
    rs.doUnmock('../../../src/element-template/native/callDestroyLifetimeFun.js');
    rs.doUnmock('../../../src/element-template/native/reload-background.js');
    rs.doUnmock('../../../src/element-template/prop-adapters/event.js');
    rs.doUnmock('../../../src/element-template/background/document.js');
    rs.doUnmock('../../../src/element-template/background/hydration-listener.js');
    rs.doUnmock('../../../src/element-template/background/commit-hook.js');
    rs.doUnmock('../../../src/element-template/background/instance.js');
    rs.doUnmock('../../../src/element-template/debug/elementPAPICall.js');
    rs.doUnmock('../../../src/element-template/debug/profile.js');
    rs.doUnmock('../../../src/element-template/lynx/env.js');
    rs.doUnmock('../../../src/element-template/lynx/performance.js');
    rs.doUnmock('../../../src/core/lynx-update-data.js');
    rs.doUnmock('../../../src/core/globalProps.js');
    rs.doUnmock('../../../src/element-template/runtime/page/root-instance.js');
  });

  it('installs main-thread wiring only on main thread', async () => {
    envManager.resetEnv('main');
    globalThis.__ALOG_ELEMENT_API__ = true;

    const injectCalledByNative = rs.fn();
    const installElementTemplatePatchListener = rs.fn();
    const installOnMtsDestruction = rs.fn();
    const initElementTemplatePAPICallAlog = rs.fn();
    const initProfileHook = rs.fn();
    const setupLynxEnv = rs.fn();
    const installElementTemplateCommitHook = rs.fn();
    const setupBackgroundElementTemplateDocument = rs.fn();
    const installElementTemplateHydrationListener = rs.fn();
    const setRoot = rs.fn();
    const initTimingAPI = rs.fn();
    const reloadBackground = rs.fn();

    rs.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    rs.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    rs.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    rs.doMock('../../../src/element-template/debug/elementPAPICall.js', () => ({
      initElementTemplatePAPICallAlog,
    }));
    rs.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    rs.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    rs.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    rs.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    rs.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    rs.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    rs.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    rs.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {},
      BackgroundPageRootInstance: class BackgroundPageRootInstance {},
    }));
    rs.doMock('../../../src/element-template/native/reload-background.js', () => ({
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
    globalThis.lynx.performance.isProfileRecording = rs.fn(() => true);

    const injectCalledByNative = rs.fn();
    const installElementTemplatePatchListener = rs.fn();
    const installOnMtsDestruction = rs.fn();
    const installElementTemplateCommitHook = rs.fn();
    const setupBackgroundElementTemplateDocument = rs.fn();
    const installElementTemplateHydrationListener = rs.fn();
    const initProfileHook = rs.fn();
    const setupLynxEnv = rs.fn();
    const initTimingAPI = rs.fn();
    const setRoot = rs.fn();
    const callDestroyLifetimeFun = rs.fn();
    const publishEvent = rs.fn();
    const publicComponentEvent = rs.fn();
    const resetEventStateForRuntime = rs.fn();
    const updateCardData = rs.fn();
    const updateGlobalProps = rs.fn();
    const reloadBackground = rs.fn();
    class MockBackgroundElementTemplateInstance {
      constructor(public type: string) {}
    }
    class MockBackgroundPageRootInstance extends MockBackgroundElementTemplateInstance {
      constructor() {
        super('root');
      }
    }

    rs.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    rs.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    rs.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    rs.doMock('../../../src/element-template/background/commit-hook.js', () => ({
      installElementTemplateCommitHook,
    }));
    rs.doMock('../../../src/element-template/background/document.js', () => ({
      setupBackgroundElementTemplateDocument,
    }));
    rs.doMock('../../../src/element-template/background/hydration-listener.js', () => ({
      installElementTemplateHydrationListener,
    }));
    rs.doMock('../../../src/element-template/debug/profile.js', () => ({
      initProfileHook,
    }));
    rs.doMock('../../../src/element-template/lynx/env.js', () => ({
      setupLynxEnv,
    }));
    rs.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));
    rs.doMock('../../../src/core/lynx-update-data.js', () => ({
      updateCardData,
    }));
    rs.doMock('../../../src/core/globalProps.js', () => ({
      updateGlobalProps,
    }));
    rs.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    rs.doMock('../../../src/element-template/native/callDestroyLifetimeFun.js', () => ({
      callDestroyLifetimeFun,
    }));
    rs.doMock('../../../src/element-template/prop-adapters/event.js', () => ({
      publishEvent,
      publicComponentEvent,
      resetEventStateForRuntime,
    }));
    rs.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: MockBackgroundElementTemplateInstance,
      BackgroundPageRootInstance: MockBackgroundPageRootInstance,
    }));
    rs.doMock('../../../src/element-template/native/reload-background.js', () => ({
      reloadBackground,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(setRoot).toHaveBeenCalledTimes(1);
    expect(setRoot).toHaveBeenCalledWith(expect.any(MockBackgroundPageRootInstance));
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(installElementTemplateCommitHook).toHaveBeenCalledTimes(1);
    expect(initTimingAPI).toHaveBeenCalledTimes(1);
    expect(initProfileHook).toHaveBeenCalledTimes(1);
    expect(setupLynxEnv).toHaveBeenCalledTimes(1);
    expect(resetEventStateForRuntime).toHaveBeenCalledTimes(1);
    expect(globalThis.lynx.getApp().callDestroyLifetimeFun).toBe(callDestroyLifetimeFun);
    expect(globalThis.lynx.getApp().publishEvent).toBe(publishEvent);
    expect(globalThis.lynx.getApp().publicComponentEvent).toBe(publicComponentEvent);
    expect(globalThis.lynx.getApp().updateGlobalProps).toEqual(expect.any(Function));
    expect(globalThis.lynx.getApp().updateCardData).toBe(updateCardData);
    expect(globalThis.lynx.getApp().onAppReload).toBe(reloadBackground);

    globalThis.lynx.getApp().updateGlobalProps({ theme: 'light' });
    expect(updateGlobalProps).toHaveBeenCalledWith(
      { theme: 'light' },
      { forceRerender: expect.any(Function) },
    );

    expect(injectCalledByNative).not.toHaveBeenCalled();
    expect(installElementTemplatePatchListener).not.toHaveBeenCalled();
    expect(installOnMtsDestruction).not.toHaveBeenCalled();

    rs.resetModules();
    globalThis.lynx.performance.isProfileRecording = rs.fn(() => false);

    await import('../../../src/element-template/native/index.js');

    expect(initTimingAPI).toHaveBeenCalledTimes(2);
    expect(initProfileHook).toHaveBeenCalledTimes(1);
  });
});
