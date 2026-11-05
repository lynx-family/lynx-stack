import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();
const installElementTemplateRefInitValueListener = vi.fn();

describe('element-template native index wiring', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock('../../../src/element-template/main-thread-ref-init-value.js', async (importOriginal) => ({
      ...await importOriginal<typeof import('../../../src/element-template/main-thread-ref-init-value.js')>(),
      installElementTemplateRefInitValueListener,
    }));
    globalThis.__ALOG_ELEMENT_API__ = undefined;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    globalThis.__ALOG_ELEMENT_API__ = undefined;
    vi.resetModules();
    vi.doUnmock('../../../src/element-template/main-thread-ref-init-value.js');
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
    vi.restoreAllMocks();
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
    expect(installElementTemplateRefInitValueListener).toHaveBeenCalledTimes(1);
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
    vi.spyOn(globalThis.lynx, 'getApp').mockReturnValue({
      _params: { initData: { value: 1 }, updateData: {} },
    });
    const app = globalThis.lynx.getApp();
    const legacyPageHandler = vi.fn();
    const legacyComponentHandler = vi.fn();
    app.publishEvent = legacyPageHandler;
    app.publicComponentEvent = legacyComponentHandler;
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
    const pageResult = { handled: true };
    const publishEvent = vi.fn(() => pageResult);
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
    expect(initProfileHook).toHaveBeenCalledTimes(1);
    expect(setupLynxEnv).toHaveBeenCalledTimes(1);
    expect(resetEventStateForRuntime).toHaveBeenCalledTimes(1);
    const pageEntry = app.publishEvent;
    const componentEntry = app.publicComponentEvent;
    const eventData = { type: 'tap' };
    expect(pageEntry('page-handler', eventData, 0)).toBe(pageResult);
    expect(publishEvent).toHaveBeenCalledExactlyOnceWith('page-handler', eventData, undefined);
    expect(componentEntry('component-7', 'component-handler', eventData)).toBe(pageResult);
    expect(publishEvent).toHaveBeenLastCalledWith('component-handler', eventData, 'component-7');
    expect(legacyPageHandler).not.toHaveBeenCalled();
    expect(legacyComponentHandler).not.toHaveBeenCalled();
    expect(app.updateGlobalProps).toEqual(expect.any(Function));

    app.updateCardData({ value: 2 });
    expect(updateCardData).toHaveBeenLastCalledWith(
      { value: 2 },
      { resetPageData: false, processorName: undefined },
    );
    app.updateCardData({ value: 3 }, { type: 1, processorName: 'reset' });
    expect(updateCardData).toHaveBeenLastCalledWith(
      { value: 3 },
      { resetPageData: true, processorName: 'reset' },
    );
    expect(updateCardData).toHaveBeenCalledTimes(2);

    app.onAppReload({ value: 4 });
    expect(reloadBackground).toHaveBeenLastCalledWith({ value: 4 }, {});
    app.onAppReload({ value: 5 }, { processorName: 'reload' });
    expect(reloadBackground).toHaveBeenLastCalledWith(
      { value: 5 },
      { processorName: 'reload' },
    );
    expect(reloadBackground).toHaveBeenCalledTimes(2);
    expect(app.publishEvent).toBe(pageEntry);
    expect(app.publicComponentEvent).toBe(componentEntry);

    app.updateGlobalProps({ theme: 'light' });
    expect(updateGlobalProps).toHaveBeenCalledWith(
      { theme: 'light' },
      { forceRerender: expect.any(Function) },
    );

    expect(injectCalledByNative).not.toHaveBeenCalled();
    expect(installElementTemplateRefInitValueListener).not.toHaveBeenCalled();
    expect(installElementTemplatePatchListener).not.toHaveBeenCalled();
    expect(installOnMtsDestruction).not.toHaveBeenCalled();

    app.callDestroyLifetimeFun();
    expect(callDestroyLifetimeFun).toHaveBeenCalledTimes(1);
    expect(app.updateCardData).toBeUndefined();
    expect(app.onAppReload).toBeUndefined();
    expect(app.callDestroyLifetimeFun).toBeUndefined();
    expect(pageEntry('page-handler', eventData)).toBeUndefined();
    expect(componentEntry('component-7', 'component-handler', eventData)).toBeUndefined();
    expect(publishEvent).toHaveBeenCalledTimes(2);
    expect(legacyPageHandler).not.toHaveBeenCalled();
    expect(legacyComponentHandler).not.toHaveBeenCalled();
  });
});
