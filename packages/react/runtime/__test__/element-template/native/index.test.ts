import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('element-template native index wiring', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalProfileFlag = globalThis.__PROFILE__;
  const originalIsProfileRecording = globalThis.lynx.performance.isProfileRecording;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.__ALOG_ELEMENT_API__ = undefined;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    globalThis.__ALOG_ELEMENT_API__ = undefined;
    globalThis.__PROFILE__ = originalProfileFlag;
    globalThis.lynx.performance.isProfileRecording = originalIsProfileRecording;
    vi.resetModules();
    vi.doUnmock('../../../src/element-template/native/main-thread-api.js');
    vi.doUnmock('../../../src/element-template/native/patch-listener.js');
    vi.doUnmock('../../../src/element-template/native/mts-destroy.js');
    vi.doUnmock('../../../src/element-template/native/callDestroyLifetimeFun.js');
    vi.doUnmock('../../../src/element-template/native/reload-background.js');
    vi.doUnmock('../../../src/element-template/prop-adapters/event.js');
    vi.doUnmock('../../../src/element-template/background/document.js');
    vi.doUnmock('../../../src/element-template/background/hydration-listener.js');
    vi.doUnmock('../../../src/element-template/background/commit-hook.js');
    vi.doUnmock('../../../src/element-template/background/instance.js');
    vi.doUnmock('../../../src/element-template/debug/elementPAPICall.js');
    vi.doUnmock('../../../src/element-template/debug/profile.js');
    vi.doUnmock('../../../src/element-template/lynx/env.js');
    vi.doUnmock('../../../src/element-template/lynx/performance.js');
    vi.doUnmock('../../../src/core/lynx-update-data.js');
    vi.doUnmock('../../../src/core/globalProps.js');
    vi.doUnmock('../../../src/element-template/runtime/page/root-instance.js');
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

    vi.doMock('../../../src/element-template/native/main-thread-api.js', () => ({
      injectCalledByNative,
    }));
    vi.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      installElementTemplatePatchListener,
    }));
    vi.doMock('../../../src/element-template/native/mts-destroy.js', () => ({
      installOnMtsDestruction,
    }));
    vi.doMock('../../../src/element-template/debug/elementPAPICall.js', () => ({
      initElementTemplatePAPICallAlog,
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
      BackgroundPageRootInstance: class BackgroundPageRootInstance {},
    }));
    vi.doMock('../../../src/element-template/native/reload-background.js', () => ({
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

  async function expectBackgroundWiring(
    compileTimeProfile: boolean,
    isProfileRecording: boolean,
    expectedProfileHookCalls: number,
  ): Promise<void> {
    envManager.resetEnv('background');
    process.env['NODE_ENV'] = 'production';
    globalThis.__PROFILE__ = compileTimeProfile;
    globalThis.lynx.performance.isProfileRecording = vi.fn(
      () => isProfileRecording,
    );

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
    class MockBackgroundElementTemplateInstance {
      constructor(public type: string) {}
    }
    class MockBackgroundPageRootInstance extends MockBackgroundElementTemplateInstance {
      constructor() {
        super('root');
      }
    }

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
    vi.doMock('../../../src/core/lynx-update-data.js', () => ({
      updateCardData,
    }));
    vi.doMock('../../../src/core/globalProps.js', () => ({
      updateGlobalProps,
    }));
    vi.doMock('../../../src/element-template/runtime/page/root-instance.js', () => ({
      setRoot,
    }));
    vi.doMock('../../../src/element-template/native/callDestroyLifetimeFun.js', () => ({
      callDestroyLifetimeFun,
    }));
    vi.doMock('../../../src/element-template/prop-adapters/event.js', () => ({
      publishEvent,
      publicComponentEvent,
      resetEventStateForRuntime,
    }));
    vi.doMock('../../../src/element-template/background/instance.js', () => ({
      BackgroundElementTemplateInstance: MockBackgroundElementTemplateInstance,
      BackgroundPageRootInstance: MockBackgroundPageRootInstance,
    }));
    vi.doMock('../../../src/element-template/native/reload-background.js', () => ({
      reloadBackground,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(setRoot).toHaveBeenCalledTimes(1);
    expect(setRoot).toHaveBeenCalledWith(expect.any(MockBackgroundPageRootInstance));
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(installElementTemplateCommitHook).toHaveBeenCalledTimes(1);
    expect(initTimingAPI).toHaveBeenCalledTimes(1);
    expect(initProfileHook).toHaveBeenCalledTimes(expectedProfileHookCalls);
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
  }

  it.each([
    ['default Web', false, false, 0],
    ['compile-time profiling', true, false, 1],
    ['host recording', false, true, 1],
  ])(
    'installs background wiring for %s',
    async (_activation, compileTimeProfile, isProfileRecording, expectedProfileHookCalls) => {
      expect.hasAssertions();
      await expectBackgroundWiring(
        compileTimeProfile,
        isProfileRecording,
        expectedProfileHookCalls,
      );
    },
  );
});
