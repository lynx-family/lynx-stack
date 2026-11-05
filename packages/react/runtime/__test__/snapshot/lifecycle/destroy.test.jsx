import { act } from 'preact/test-utils';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

describe('Destroy', () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeAll(() => {
    lynx.getCoreContext = vi.fn(() => {
      return {
        addEventListener,
        removeEventListener,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('preserves pending refs on reload and stops patches and ref values during host destruction', async () => {
    const previousApp = lynx.getApp();
    const app = { GlobalEventEmitter: previousApp.GlobalEventEmitter, _params: {} };
    vi.spyOn(lynx, 'getApp').mockReturnValue(app);
    vi.resetModules();
    // Load the MTS module in its own context before the mixed-thread DSL graph.
    const wasJS = globalThis.__JS__;
    globalThis.__JS__ = false;
    await import('@lynx-js/lynx-runtime/mts');
    globalThis.__JS__ = wasJS;
    const { globalEnvManager } = await import('../utils/envManager');
    globalEnvManager.switchToBackground();
    await import('../../../src/lynx');
    vi.stubGlobal('SystemInfo', { lynxSdkVersion: '4.2' });
    const { clearMtsConfigCacheForTesting, isMtsEnabled } = await import('../../../src/core/mts-capability');
    clearMtsConfigCacheForTesting();
    expect(isMtsEnabled()).toBe(true);
    const { Component, h, render } = await import('preact');
    const { MainThreadRef, useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');
    const { globalCommitTaskMap, replaceCommitHook } = await import(
      '../../../src/snapshot/lifecycle/patch/commit'
    );
    const snapshotPatch = await import(
      '../../../src/snapshot/lifecycle/patch/snapshotPatch'
    );
    const { takeMainThreadRefInitValuePatch } = await import('../../../src/core/main-thread-ref-init-value');
    const initialRef = new MainThreadRef('initial');
    expect(takeMainThreadRefInitValuePatch()).toEqual([[initialRef.toJSON()._wvid, 'initial']]);
    const patchState = await import(
      '../../../src/snapshot/lifecycle/patch/globalState'
    );
    const { backgroundSnapshotInstanceManager } = await import('../../../src/snapshot/snapshot/backgroundSnapshot');
    const events = await import('../../../src/snapshot/lifecycle/event/delayEvents');
    const lifecycleEvents = await import('../../../src/snapshot/lifecycle/event/delayLifecycleEvents');
    replaceCommitHook();

    const cleanup = vi.fn(() => {
      new MainThreadRef('created in cleanup');
    });
    const ref = vi.fn();
    let sharedRef;
    const renderedRefs = [];
    function Effect() {
      useEffect(() => cleanup, []);
      return h('view');
    }
    class Comp extends Component {
      componentWillUnmount() {
        new MainThreadRef('created before unmount commit');
      }

      render() {
        renderedRefs.push(sharedRef);
        return h(Effect);
      }
    }

    snapshotPatch.initGlobalSnapshotPatch();
    __root.__jsx = h(Comp, { ref });
    render(__root.__jsx, __root);
    await Promise.resolve();
    const nativeApp = lynx.getNativeApp();
    nativeApp.callLepusMethod.mockClear();
    sharedRef = new MainThreadRef('retained across reload');
    vi.useFakeTimers();
    app.onAppReload({});
    await Promise.resolve();
    const synchronizedRefs = nativeApp.callLepusMethod.mock.calls
      .filter(([name]) => name === 'rLynxChangeRefInitValue')
      .flatMap(([, payload]) => JSON.parse(payload.data));
    expect(synchronizedRefs).toContainEqual([sharedRef.toJSON()._wvid, 'retained across reload']);
    expect(renderedRefs.at(-1)).toBe(sharedRef);
    expect(cleanup).toHaveBeenCalledTimes(1);
    cleanup.mockClear();
    snapshotPatch.initGlobalSnapshotPatch();
    const removedId = __root.childNodes[0].__id;
    const completed = vi.fn();
    globalCommitTaskMap.set(-1, completed);
    nativeApp.callLepusMethod.mockClear();
    events.delayedPublishEvent('pending', {});
    lifecycleEvents.delayLifecycleEvent('pending', {});

    expect(() => act(() => app.callDestroyLifetimeFun())).not.toThrow();
    expect(nativeApp.callLepusMethod).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenLastCalledWith(null);
    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(globalCommitTaskMap.size).toBe(0);
    expect(patchState.globalBackgroundSnapshotInstancesToRemove).toEqual([]);
    expect(events.delayedEvents).toEqual([]);
    expect(lifecycleEvents.delayedLifecycleEvents).toEqual([]);
    expect(snapshotPatch.__globalSnapshotPatch).toBeUndefined();
    vi.runAllTimers();
    expect(backgroundSnapshotInstanceManager.values.has(removedId)).toBe(false);
  });

  test('should remove event listener when throw in cleanup', async function() {
    // A new page evaluates fresh modules against a new SDK App instance.
    const previousApp = lynx.getApp();
    vi.spyOn(lynx, 'getApp').mockReturnValue({
      GlobalEventEmitter: previousApp.GlobalEventEmitter,
      _params: {},
    });
    vi.resetModules();
    // Load the MTS module in its own context before the mixed-thread DSL graph.
    const wasJS = globalThis.__JS__;
    globalThis.__JS__ = false;
    await import('@lynx-js/lynx-runtime/mts');
    globalThis.__JS__ = wasJS;
    await import('../../../src/lynx');

    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    const { h, render } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const callback = vi.fn().mockImplementation(() => {
      throw '???';
    });

    function Comp() {
      useEffect(() => callback, []);
      return null;
    }

    render(h(Comp), __root);
    await Promise.resolve().then(() => {});

    // Preact 11 defers passive-effect cleanups of unmounted components to the
    // after-paint flush; act() drains that flush synchronously and rethrows
    // the cleanup's error, so the assertion stays synchronous.
    expect(() => act(() => lynx.getApp().callDestroyLifetimeFun())).toThrow('???');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
