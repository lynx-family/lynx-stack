// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import {
  NATIVE_EVENT_DESTROY_LIFETIME,
  NATIVE_EVENT_RENDER_PAGE,
  NATIVE_EVENT_UPDATE_GLOBAL_PROPS,
  NATIVE_EVENT_UPDATE_PAGE,
} from '../src/common/protocol.js';
import type {
  HostContextProxy,
  HostGlobalScope,
  HostMessageEvent,
  HostPerformanceObject,
  LynxSystemInfo,
  MTSFlushOptions,
} from '../src/common/types.js';
import {
  createPipeline,
  flushElementTree,
  getGlobalProps,
  getInitData,
  getSystemInfo,
  isDestroyed,
  markTiming,
  onDestroy,
  onGlobalPropsChanged,
  onMessage,
  onReload,
  onRenderPage,
  onUpdateData,
  sendMessage,
  setDataProcessor,
  setPageDataGetter,
} from '../src/mts.js';

const hostGlobal = globalThis as unknown as HostGlobalScope;

function createMockContextProxy(): HostContextProxy & {
  emit(type: string, data: unknown): void;
  hasEventListener(type: string): boolean;
} {
  const listeners = new Map<string, Set<(event: HostMessageEvent) => void>>();
  return {
    dispatchEvent: vi.fn((event: { type: string; data: unknown }) => {
      const set = listeners.get(event.type);
      if (set) {
        for (const fn of [...set]) {
          fn({ type: event.type, data: event.data });
        }
      }
      return 0;
    }),
    addEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        let set = listeners.get(type);
        if (!set) {
          set = new Set();
          listeners.set(type, set);
        }
        set.add(listener as (event: HostMessageEvent) => void);
      },
    ),
    removeEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        listeners.get(type)?.delete(
          listener as (event: HostMessageEvent) => void,
        );
      },
    ),
    emit(type: string, data: unknown) {
      const set = listeners.get(type);
      if (set) {
        for (const fn of [...set]) {
          fn({ type, data });
        }
      }
    },
    hasEventListener(type: string): boolean {
      return (listeners.get(type)?.size ?? 0) > 0;
    },
  };
}

afterEach(() => {
  delete hostGlobal.__FlushElementTree;
  delete hostGlobal.SystemInfo;
  delete hostGlobal.lynx;
  delete hostGlobal.renderPage;
  delete hostGlobal.updatePage;
  delete hostGlobal.updateGlobalProps;
  delete hostGlobal.processData;
  delete hostGlobal.getPageData;
  delete hostGlobal.removeComponents;
});

describe('MTS runtime functions', () => {
  it('preserves DSL-owned renderPage and updatePage during incremental adoption of flush, messaging, destroy, GlobalProps, and single-owner hooks', () => {
    const engineProxy = createMockContextProxy();
    const nativeProxy = createMockContextProxy();
    const jsProxy = createMockContextProxy();
    const flushSpy = vi.fn();
    const dslRender = vi.fn();
    const dslUpdate = vi.fn();
    hostGlobal.__FlushElementTree = flushSpy;
    hostGlobal.renderPage = dslRender;
    hostGlobal.updatePage = dslUpdate;
    hostGlobal.lynx = {
      __globalProps: { theme: 'light' },
      getEngine: () => engineProxy,
      getNative: () => nativeProxy,
      getJSContext: () => jsProxy,
    };

    const msgSpy = vi.fn();
    const destroySpy = vi.fn();
    flushElementTree();
    sendMessage('dsl:ping', { ok: true });
    const stopMsg = onMessage('dsl:pong', msgSpy);
    onDestroy(destroySpy);

    // Flush, messaging, and onDestroy do not touch any host global slots or Engine page listeners:
    expect(hostGlobal.renderPage).toBe(dslRender);
    expect(hostGlobal.updatePage).toBe(dslUpdate);
    expect(hostGlobal.updateGlobalProps).toBeUndefined();
    expect(hostGlobal.processData).toBeUndefined();
    expect(hostGlobal.getPageData).toBeUndefined();
    expect(engineProxy.hasEventListener(NATIVE_EVENT_RENDER_PAGE)).toBe(false);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_UPDATE_PAGE)).toBe(false);

    // GlobalProps and single-owner hooks only claim their own channels without hijacking renderPage / updatePage:
    expect(getGlobalProps()).toEqual({ theme: 'light' });
    const propsSpy = vi.fn();
    onGlobalPropsChanged(propsSpy);
    setDataProcessor((data: { v: number }) => ({ v: data.v + 1 }));
    setPageDataGetter(() => ({ live: 1 }));

    expect(hostGlobal.renderPage).toBe(dslRender);
    expect(hostGlobal.updatePage).toBe(dslUpdate);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_RENDER_PAGE)).toBe(false);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_UPDATE_PAGE)).toBe(false);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_UPDATE_GLOBAL_PROPS)).toBe(
      true,
    );

    hostGlobal.renderPage({ count: 0 });
    hostGlobal.updatePage({ count: 1 }, {});
    expect(dslRender).toHaveBeenCalledExactlyOnceWith({ count: 0 });
    expect(dslUpdate).toHaveBeenCalledExactlyOnceWith({ count: 1 }, {});

    stopMsg();
    nativeProxy.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    expect(destroySpy).toHaveBeenCalledExactlyOnceWith();
    expect(hostGlobal.renderPage).toBe(dslRender);
    expect(hostGlobal.updatePage).toBe(dslUpdate);
  });

  it('delivers Engine events to explicitly migrated handlers, isolates initial data, and cleans up on destroy', () => {
    const engineProxy = createMockContextProxy();
    const nativeProxy = createMockContextProxy();
    hostGlobal.lynx = {
      __initData: { preloadedByDSL: 'v0' },
      __globalProps: { theme: 'light' },
      getEngine: () => engineProxy,
      getNative: () => nativeProxy,
    };

    const preExistingRenderSpy = vi.fn();
    hostGlobal.renderPage = preExistingRenderSpy;

    // No host input has arrived; DSL state is not an initial-input source:
    expect(getInitData()).toEqual({});
    hostGlobal.lynx.__initData = { mutatedByDSLBeforeRender: true };
    expect(getInitData()).toEqual({});
    expect(getGlobalProps()).toEqual({ theme: 'light' });

    const renderSpy = vi.fn();
    const updateSpy = vi.fn();
    const reloadSpy = vi.fn();
    const globalPropsSpy = vi.fn();
    const destroySpy = vi.fn();

    onRenderPage(preExistingRenderSpy);
    onRenderPage(renderSpy);
    onUpdateData(updateSpy);
    onUpdateData(updateSpy);
    onReload(reloadSpy);
    onGlobalPropsChanged(globalPropsSpy);
    onDestroy(destroySpy);

    const renderPayload = { title: 'Hello' };
    const nativeElementRef = { __elementRef: 1 };
    const renderOptions = {
      preLoadTemplate: true,
      processorName: 'mainProcessor',
      initPage: nativeElementRef,
      pipelineOptions: {
        pipelineID: 'pipe-1',
        pipelineOrigin: 'LoadTemplate',
        needTimestamps: true,
      },
    };
    engineProxy.emit(NATIVE_EVENT_RENDER_PAGE, [renderPayload, renderOptions]);

    // Migrating the old handler explicitly delivers one notification to each subscriber:
    expect(preExistingRenderSpy).toHaveBeenCalledTimes(1);
    expect(preExistingRenderSpy).toHaveBeenCalledWith(
      renderPayload,
      renderOptions,
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(renderPayload, renderOptions);
    expect(getInitData()).toEqual({ title: 'Hello' });
    // Runtime must not overwrite DSL-managed lynx.__initData:
    expect(hostGlobal.lynx.__initData).toEqual({
      mutatedByDSLBeforeRender: true,
    });
    expect(hostGlobal.getPageData?.()).toBeNull();

    const updateOptions = {
      resetPageData: true,
      reloadFromJS: false,
      reloadTemplate: false,
      nativeUpdateDataOrder: 3,
      triggerLifeCycle: true,
      processorName: 'updateProc',
      pipelineOptions: {
        pipelineID: 'pipe-2',
        pipelineOrigin: 'UpdateData',
        needTimestamps: false,
      },
    };
    engineProxy.emit(NATIVE_EVENT_UPDATE_PAGE, [
      { title: 'Updated' },
      updateOptions,
    ]);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({ title: 'Updated' }, updateOptions);
    // Simulate DSL mutating lynx.__initData on updatePage; getInitData() must remain isolated:
    hostGlobal.lynx.__initData = { title: 'UpdatedInDSLState' };
    expect(getInitData()).toEqual({ title: 'Hello' });

    // Reload update (`reloadTemplate: true`) routes to onReload and updates getInitData() baseline:
    const reloadPayload = { title: 'ReloadedInitial' };
    engineProxy.emit(NATIVE_EVENT_UPDATE_PAGE, [
      reloadPayload,
      { reloadTemplate: true },
    ]);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledWith(reloadPayload, {
      reloadTemplate: true,
    });
    expect(getInitData()).toEqual({ title: 'ReloadedInitial' });

    const globalPropsOptions = {
      nativeUpdateDataOrder: 4,
      pipelineOptions: { pipelineID: 'props' },
    };
    engineProxy.emit(NATIVE_EVENT_UPDATE_GLOBAL_PROPS, [
      { theme: 'dark' },
      globalPropsOptions,
    ]);
    expect(globalPropsSpy).toHaveBeenCalledWith(
      { theme: 'dark' },
      globalPropsOptions,
    );
    expect(getGlobalProps()).toEqual({ theme: 'dark' });

    nativeProxy.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    expect(destroySpy).toHaveBeenCalledTimes(1);

    // Engine listeners are removed on destroy and globalThis entrypoints are restored:
    expect(engineProxy.hasEventListener(NATIVE_EVENT_RENDER_PAGE)).toBe(false);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_UPDATE_PAGE)).toBe(false);
    expect(engineProxy.hasEventListener(NATIVE_EVENT_UPDATE_GLOBAL_PROPS)).toBe(
      false,
    );
    expect(hostGlobal.renderPage).toBe(preExistingRenderSpy);
    engineProxy.emit(NATIVE_EVENT_UPDATE_PAGE, [{ title: 'Ignored' }, {}]);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'captures initial/reload inputs independently of listeners (Engine: %s)',
    async (useEngine) => {
      vi.resetModules();
      const engine = createMockContextProxy();
      const native = createMockContextProxy();
      const oldRender = vi.fn();
      const oldUpdate = vi.fn();
      hostGlobal.renderPage = oldRender;
      hostGlobal.updatePage = oldUpdate;
      hostGlobal.lynx = {
        __globalProps: { theme: 'old' },
        getNative: () => native,
        ...(useEngine ? { getEngine: () => engine } : {}),
      };
      // Evaluate in the host before Native delivers data; no Runtime notification subscription.
      const mts = await import('../src/mts.js');
      hostGlobal.lynx.__initData = { dslBeforeFirstInput: true };
      expect(mts.getInitData()).toEqual({});
      const deliver = (
        event: string,
        key: 'renderPage' | 'updatePage',
        data: Record<string, unknown>,
        options = {},
      ) => {
        if (useEngine) engine.emit(event, [data, options]);
        else hostGlobal[key]?.(data, options);
      };
      const initial = { round: 1 };
      deliver(NATIVE_EVENT_RENDER_PAGE, 'renderPage', initial);
      initial.round = 99;
      expect(mts.getInitData()).toEqual({ round: 1 });
      expect(oldRender).not.toHaveBeenCalled();
      const unsub = mts.onUpdateData(vi.fn());
      unsub();
      deliver(NATIVE_EVENT_UPDATE_PAGE, 'updatePage', { round: 2 }, {
        reloadTemplate: true,
      });
      expect(mts.getInitData()).toEqual({ round: 2 });
      deliver(NATIVE_EVENT_UPDATE_PAGE, 'updatePage', { incremental: true });
      hostGlobal.lynx.__initData = { dsl: 'current' };
      expect(mts.getInitData()).toEqual({ round: 2 });
      expect(oldUpdate).not.toHaveBeenCalled();
      // Native's property is authoritative even without a Runtime GlobalProps notification.
      hostGlobal.lynx.__globalProps = { theme: 'new' };
      expect(mts.getGlobalProps()).toEqual({ theme: 'new' });
      native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
      expect(engine.hasEventListener(NATIVE_EVENT_RENDER_PAGE)).toBe(false);
      expect(engine.hasEventListener(NATIVE_EVENT_UPDATE_PAGE)).toBe(false);
    },
  );

  it('uses Web Engine destruction to release inputs and single-owner hooks', () => {
    const engine = createMockContextProxy();
    hostGlobal.SystemInfo = { platform: 'web' };
    hostGlobal.lynx = { getEngine: () => engine };
    const destroy = vi.fn();
    onDestroy(destroy);
    const render = vi.fn();
    onRenderPage(render);
    setDataProcessor((data: { count: number }) => ({ count: data.count * 2 }));
    setPageDataGetter(() => ({ current: true }));

    engine.emit(NATIVE_EVENT_RENDER_PAGE, [{ count: 2 }, {}]);
    expect(render).toHaveBeenCalledTimes(1);
    engine.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(engine.hasEventListener(NATIVE_EVENT_RENDER_PAGE)).toBe(false);
    expect(engine.hasEventListener(NATIVE_EVENT_DESTROY_LIFETIME)).toBe(false);
    expect(hostGlobal.processData?.({ count: 2 })).toEqual({ count: 2 });
    expect(hostGlobal.getPageData?.()).toBeNull();
  });

  it('does not activate a dormant global fallback when an existing Engine listener handles input', async () => {
    vi.resetModules();
    const engine = createMockContextProxy();
    const render = vi.fn();
    hostGlobal.renderPage = render;
    engine.addEventListener(NATIVE_EVENT_RENDER_PAGE, () => {
      render();
    });
    hostGlobal.lynx = { getEngine: () => engine };
    const mts = await import('../src/mts.js');
    const observer = vi.fn();
    mts.onRenderPage(observer);
    engine.emit(NATIVE_EVENT_RENDER_PAGE, [{ page: 1 }, {}]);
    expect(render).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(mts.getInitData()).toEqual({ page: 1 });
  });

  it('keeps listeners alive across C++ ReloadTemplate (processData -> removeComponents -> updatePage) and updates getInitData', () => {
    const nativeProxy = createMockContextProxy();
    hostGlobal.lynx = {
      getNative: () => nativeProxy,
    };

    const updateSpy = vi.fn();
    const reloadSpy = vi.fn(() => {
      // Inside reload listener, getInitData() already reflects the reloaded initial data:
      expect(getInitData()).toEqual({ count: 15 });
    });
    const destroySpy = vi.fn();
    onUpdateData(updateSpy);
    onReload(reloadSpy);
    onDestroy(destroySpy);
    setDataProcessor((data: { count: number }) => ({
      count: data.count + 10,
    }));

    // Simulate C++ TemplateAssembler::ReloadTemplate sequence:
    // 1. ProcessTemplateDataForFiber calls globalThis.processData:
    const processed = hostGlobal.processData?.({ count: 5 }) as {
      count: number;
    };
    expect(processed).toEqual({ count: 15 });

    // 2. ReloadTemplate calls removeComponents() BEFORE UpdateTemplate:
    expect(() => hostGlobal.removeComponents?.()).not.toThrow();
    expect(destroySpy).not.toHaveBeenCalled();

    // 3. ReloadTemplate immediately calls updatePage(processed, { reloadTemplate: true }):
    hostGlobal.updatePage?.(processed, { reloadTemplate: true });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledWith(
      { count: 15 },
      { reloadTemplate: true },
    );
    expect(getInitData()).toEqual({ count: 15 });
  });

  it('provides safe C++ GetAndCall (try_call = false) defaults, single-owner setDataProcessor / setPageDataGetter replacement, and degrades onDestroy to a no-op when getNative / getEngine is unavailable', () => {
    const prevUpdateGlobalProps = vi.fn(() => {
      // Migrated callback must observe already-updated lynx.__globalProps:
      expect(getGlobalProps()).toEqual({ locale: 'zh-CN' });
    });
    hostGlobal.lynx = {};
    hostGlobal.updateGlobalProps = prevUpdateGlobalProps;

    // On legacy SDKs (2.14–3.3) without lynx.getNative(), onDestroy safely returns an idempotent no-op disposer:
    const legacyDestroySpy = vi.fn();
    const unsubDestroy = onDestroy(legacyDestroySpy);
    expect(typeof unsubDestroy).toBe('function');
    expect(onDestroy(legacyDestroySpy)).toBe(unsubDestroy);
    expect(isDestroyed()).toBe(false);
    expect(() => {
      unsubDestroy();
      unsubDestroy();
    }).not.toThrow();
    expect(legacyDestroySpy).not.toHaveBeenCalled();

    // Lightweight Web hosts without getEngine() also degrade safely:
    hostGlobal.SystemInfo = { platform: 'web' };
    const unsubWebDestroy = onDestroy(legacyDestroySpy);
    expect(() => unsubWebDestroy()).not.toThrow();
    expect(isDestroyed()).toBe(false);
    delete hostGlobal.SystemInfo;

    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const unsubLegacy = onGlobalPropsChanged(prevUpdateGlobalProps);
    const unsub1 = onGlobalPropsChanged(spy1);
    const unsub2 = onGlobalPropsChanged(spy2);

    // C++ try_call = false entrypoints are always functions even when unsubscribed:
    expect(typeof hostGlobal.processData).toBe('function');
    expect(typeof hostGlobal.removeComponents).toBe('function');
    expect(typeof hostGlobal.renderPage).toBe('function');
    expect(typeof hostGlobal.updatePage).toBe('function');
    expect(typeof hostGlobal.getPageData).toBe('function');
    expect(hostGlobal.getPageData?.()).toBeNull();

    hostGlobal.updateGlobalProps?.({ locale: 'zh-CN' });
    expect(prevUpdateGlobalProps).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledWith({ locale: 'zh-CN' }, undefined);
    expect(spy2).toHaveBeenCalledWith({ locale: 'zh-CN' }, undefined);

    // Removing optional subscribers leaves the owned host entry active for getters:
    unsub1();
    unsub2();
    unsubLegacy();
    expect(hostGlobal.updateGlobalProps).not.toBe(prevUpdateGlobalProps);
    hostGlobal.updateGlobalProps?.({ locale: 'en-US' });
    expect(getGlobalProps()).toEqual({ locale: 'en-US' });
    expect(prevUpdateGlobalProps).toHaveBeenCalledTimes(1);

    // Single-owner setDataProcessor replacement and C++ empty-input normalization:
    const seenProcessorCalls: [unknown, string | undefined][] = [];
    const unsubProc1 = setDataProcessor<{ raw: number }, { v: number }>(
      (data) => ({ v: data.raw * 2 }),
    );
    const unsubProc2 = setDataProcessor<{ raw?: number }, { v: number }>(
      (data, processorName) => {
        seenProcessorCalls.push([data, processorName]);
        return { v: (data.raw ?? 1) * 3 };
      },
    );
    expect(hostGlobal.processData?.({ raw: 10 })).toEqual({ v: 30 });
    expect(hostGlobal.processData?.(undefined, '')).toEqual({ v: 3 });
    expect(hostGlobal.processData?.({ raw: 2 }, '')).toEqual({ v: 6 });
    expect(hostGlobal.processData?.({ raw: 4 }, 'named')).toEqual({ v: 12 });
    expect(seenProcessorCalls).toEqual([
      [{ raw: 10 }, undefined],
      [{}, undefined],
      [{ raw: 2 }, undefined],
      [{ raw: 4 }, 'named'],
    ]);
    unsubProc1();
    expect(hostGlobal.processData?.({ raw: 10 })).toEqual({ v: 30 });
    unsubProc2();
    expect(hostGlobal.processData?.({ raw: 10 })).toEqual({ raw: 10 });

    // Single-owner setPageDataGetter replacement for Native GetCurrentData / GetPageDataByKey:
    const currentState: Record<string, unknown> = { a: 1, b: 2 };
    const unsubGetter1 = setPageDataGetter(() => ({ stale: true }));
    const unsubGetter2 = setPageDataGetter((keys) => {
      if (!keys) {
        return currentState;
      }
      return Object.fromEntries(keys.map((k) => [k, currentState[k]]));
    });
    expect(hostGlobal.getPageData?.()).toEqual({ a: 1, b: 2 });
    expect(hostGlobal.getPageData?.(['a'])).toEqual({ a: 1 });
    unsubGetter1();
    expect(hostGlobal.getPageData?.()).toEqual({ a: 1, b: 2 });
    unsubGetter2();
    expect(hostGlobal.getPageData?.()).toBeNull();
  });

  it('runs all remaining destroy and cleanup callbacks even if an earlier destroy callback throws, and resets single-owner hooks on destroy', () => {
    const nativeProxy = createMockContextProxy();
    hostGlobal.lynx = {
      getNative: () => nativeProxy,
    };

    onDestroy(() => {
      throw new Error('user destroy boom');
    });

    const updateSpy = vi.fn();
    onUpdateData(updateSpy);
    setDataProcessor<{ raw: number }, { v: number }>((d) => ({ v: d.raw + 1 }));
    setDataProcessor<{ raw: number }, { v: number }>((d) => ({ v: d.raw + 2 }));
    setPageDataGetter(() => ({ live: 1 }));
    setPageDataGetter(() => ({ live: 2 }));

    const afterThrowDestroySpy = vi.fn();
    onDestroy(afterThrowDestroySpy);

    expect(() => nativeProxy.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined))
      .toThrow('user destroy boom');

    expect(afterThrowDestroySpy).toHaveBeenCalledTimes(1);
    expect(hostGlobal.processData?.({ raw: 5 })).toEqual({ raw: 5 });
    expect(hostGlobal.getPageData?.()).toBeNull();
    hostGlobal.updatePage?.({ ignored: true }, {});
    expect(updateSpy).not.toHaveBeenCalled();
  });
  it('keeps final snapshots but rejects every activation during and after host destruction', () => {
    const engine = createMockContextProxy();
    const native = createMockContextProxy();
    const js = createMockContextProxy();
    const additions = [
      vi.spyOn(engine, 'addEventListener'),
      vi.spyOn(native, 'addEventListener'),
      vi.spyOn(js, 'addEventListener'),
    ];
    hostGlobal.lynx = {
      getEngine: () => engine,
      getNative: () => native,
      getJSContext: () => js,
      __globalProps: { theme: 'final' },
    };
    const stopRender = onRenderPage(vi.fn());
    engine.emit(NATIVE_EVENT_RENDER_PAGE, [{ seed: 1 }]);
    const oldProcessor = vi.fn(() => 'legacy');
    const oldGetter = vi.fn(() => 'legacy');
    hostGlobal.processData = oldProcessor;
    hostGlobal.getPageData = oldGetter;
    const stopProc = setDataProcessor(data => data);
    const stopGetter = setPageDataGetter(() => ({ live: true }));
    stopProc();
    stopGetter();
    expect(hostGlobal.processData?.({ value: 1 })).toEqual({ value: 1 });
    expect(hostGlobal.getPageData?.()).toBeNull();
    setDataProcessor(data => data);
    setPageDataGetter(() => ({ live: true }));
    const registrations = [
      () => onRenderPage(vi.fn()),
      () => onUpdateData(vi.fn()),
      () => onReload(vi.fn()),
      () => onGlobalPropsChanged(vi.fn()),
      () => onDestroy(vi.fn()),
      () => setDataProcessor(data => data),
      () => setPageDataGetter(() => ({})),
    ];
    const check = () => {
      const counts = additions.map(add => add.mock.calls.length);
      for (const register of registrations) {
        expect(register).toThrow(/destroying or destroyed/);
      }
      expect(getInitData()).toEqual({ seed: 1 });
      expect(getGlobalProps()).toEqual({ theme: 'final' });
      expect(additions.map(add => add.mock.calls.length)).toEqual(counts);
      stopRender();
      stopRender();
      stopProc();
      stopGetter();
    };
    onDestroy(check);
    native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    hostGlobal.lynx!.__globalProps = { theme: 'changed after destroy' };
    check();
    expect(hostGlobal.processData?.({ value: 2 })).toEqual({ value: 2 });
    expect(hostGlobal.getPageData?.()).toBeNull();
    expect(oldProcessor).not.toHaveBeenCalled();
    expect(oldGetter).not.toHaveBeenCalled();
  });

  it('defaults getGlobalProps to a stable empty object when unset before and after destruction', () => {
    const native = createMockContextProxy();
    hostGlobal.lynx = { getNative: () => native };
    const before = getGlobalProps();
    expect(before).toEqual({});
    expect(getGlobalProps()).toBe(before);
    native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    const after = getGlobalProps();
    expect(after).toEqual({});
    expect(getGlobalProps()).toBe(after);
  });
});

describe('MTS page flush', () => {
  it('preserves zero arguments and forwards a supplied options object without copying', () => {
    hostGlobal.lynx = {};
    const flush = vi.fn<NonNullable<HostGlobalScope['__FlushElementTree']>>(
      () => 7,
    );
    hostGlobal.__FlushElementTree = flush;
    expect(flushElementTree()).toBeUndefined();
    expect(flushElementTree(undefined)).toBeUndefined();
    expect(flush.mock.calls).toEqual([[], []]);

    const options = Object.freeze({
      triggerLayout: false,
      triggerDataUpdated: true,
      emptyPatch: true,
      nativeUpdateDataOrder: 2,
      pipelineOptions: { pipelineID: 'page-pipeline' },
    });
    expect(flushElementTree(options)).toBeUndefined();
    expect(flush).toHaveBeenLastCalledWith(undefined, options);
    expect(flush.mock.calls.at(-1)?.[1]).toBe(options);
    const withoutPrototype = Object.create(null) as MTSFlushOptions;
    flushElementTree(withoutPrototype);
    expect(flush.mock.calls.at(-1)?.[1]).toBe(withoutPrototype);
  });

  it('fails explicitly when the host page flush capability is unavailable', () => {
    hostGlobal.lynx = {};
    expect(() => flushElementTree()).toThrow(/requires __FlushElementTree/);
    hostGlobal.__FlushElementTree =
      1 as unknown as HostGlobalScope['__FlushElementTree'];
    expect(() => flushElementTree({})).toThrow(/requires __FlushElementTree/);
  });

  it('rejects non-plain options before entering Native and propagates Native failures', () => {
    hostGlobal.lynx = {};
    const flush = vi.fn();
    hostGlobal.__FlushElementTree = flush;
    for (
      const options of [
        null,
        [],
        1,
        'options',
        false,
        vi.fn(),
        new Date(),
        new (class Options {})(),
      ]
    ) {
      expect(() => flushElementTree(options as unknown as MTSFlushOptions))
        .toThrow(TypeError);
    }
    expect(flush).not.toHaveBeenCalled();
    const error = new Error('Native flush failed');
    flush.mockImplementation(() => {
      throw error;
    });
    expect(() => flushElementTree({})).toThrow(error);
  });

  it('rejects flushes during and after host destruction without invoking Native', () => {
    const native = createMockContextProxy();
    hostGlobal.lynx = { getNative: () => native };
    const flush = vi.fn();
    hostGlobal.__FlushElementTree = flush;
    flushElementTree();
    flush.mockClear();
    const check = () => {
      expect(() => flushElementTree()).toThrow(/destroying or destroyed/);
      expect(() => flushElementTree({ triggerDataUpdated: true })).toThrow(
        /destroying or destroyed/,
      );
      expect(flush).not.toHaveBeenCalled();
    };
    onDestroy(check);
    native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    check();
  });

  it('caches destroy and peer proxies on MTS hot paths instead of repeating host getter calls', () => {
    const native = createMockContextProxy();
    const js = createMockContextProxy();
    const dispatchSpy = vi.spyOn(js, 'dispatchEvent');
    const getNative = vi.fn(() => native);
    const getJSContext = vi.fn(() => js);
    const flush = vi.fn();
    hostGlobal.lynx = {
      getNative,
      getJSContext,
      __globalProps: { theme: 'light' },
    };
    hostGlobal.__FlushElementTree = flush;

    flushElementTree();
    flushElementTree({ triggerLayout: true });
    sendMessage('mts:hot', { n: 1 });
    sendMessage('mts:hot', { n: 2 });
    expect(isDestroyed()).toBe(false);
    expect(getGlobalProps()).toEqual({ theme: 'light' });
    markTiming('pipe-1', 't1');

    expect(getNative).toHaveBeenCalledTimes(1);
    expect(getJSContext).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('MTS host services', () => {
  beforeEach(() => {
    hostGlobal.lynx = {};
  });

  it('has no module-evaluation side effects and aliases SystemInfo on access without claiming MTS input slots', async () => {
    const info = { platform: 'android', pixelRatio: 2, deviceMode: 'tablet' };
    const getNative = vi.fn();
    hostGlobal.lynx = { SystemInfo: info, getNative };
    vi.resetModules();
    const mts = await import('../src/mts.js');
    expect(hostGlobal.SystemInfo).toBeUndefined();
    expect(hostGlobal.renderPage).toBeUndefined();
    expect(hostGlobal.processData).toBeUndefined();
    expect(getNative).not.toHaveBeenCalled();

    expect(mts.getSystemInfo()).toBe(info);
    expect(hostGlobal.SystemInfo).toBe(info);
    expect(hostGlobal.renderPage).toBeUndefined();
    expect(hostGlobal.processData).toBeUndefined();
    expect(getNative).not.toHaveBeenCalled();
    expect(mts.getSystemInfo()['deviceMode']).toBe(
      'tablet',
    );
    hostGlobal.SystemInfo!.pixelRatio = 3;
    expect(mts.getSystemInfo().pixelRatio).toBe(3);

    delete hostGlobal.SystemInfo;
    mts.onRenderPage(vi.fn());
    expect(hostGlobal.SystemInfo).toBe(info);
    expect(typeof hostGlobal.renderPage).toBe('function');
    delete hostGlobal.renderPage;
    mts.onUpdateData(vi.fn());
    expect(typeof hostGlobal.renderPage).toBe('function');
    expectTypeOf<import('../src/mts.js').CreatePipelineOptions>()
      .toEqualTypeOf<import('../src/index.js').CreatePipelineOptions>();
    expectTypeOf<import('../src/mts.js').LynxSystemInfo>()
      .toEqualTypeOf<import('../src/index.js').LynxSystemInfo>();
  });

  it('prefers lynx information without overwriting an existing plain global object', () => {
    const globalInfo = { platform: 'global' };
    const info = { platform: 'lynx' };
    hostGlobal.SystemInfo = globalInfo;
    hostGlobal.lynx = { SystemInfo: info };
    expect(getSystemInfo()).toBe(info);
    expect(hostGlobal.SystemInfo).toBe(globalInfo);
    delete hostGlobal.lynx.SystemInfo;
    expect(getSystemInfo()).toBe(globalInfo);
    delete hostGlobal.SystemInfo;
    expect(getSystemInfo()).toEqual({});
    hostGlobal.lynx.SystemInfo = info;
    expect(getSystemInfo()).toBe(info);
    expect(hostGlobal.SystemInfo).toBe(info);
  });

  it('ignores non-plain SystemInfo candidates and replaces only an invalid global alias', () => {
    const info = Object.assign(Object.create(null) as LynxSystemInfo, {
      pixelRatio: 2,
    });
    for (const invalid of [null, [], 3, new Date()]) {
      hostGlobal.lynx = { SystemInfo: invalid as unknown as LynxSystemInfo };
      hostGlobal.SystemInfo = { platform: 'global' };
      expect(getSystemInfo()).toBe(hostGlobal.SystemInfo);
      hostGlobal.SystemInfo = invalid as unknown as LynxSystemInfo;
      expect(getSystemInfo()).toEqual({});
      hostGlobal.lynx.SystemInfo = info;
      expect(getSystemInfo()).toBe(info);
      expect(hostGlobal.SystemInfo).toBe(info);
    }
  });

  it('reads the global fallback and safely skips performance when lynx is absent', () => {
    delete hostGlobal.lynx;
    const info = { platform: 'fallback' };
    hostGlobal.SystemInfo = info;
    expect(getSystemInfo()).toBe(info);
    expect(createPipeline()).toBeUndefined();
    expect(markTiming('id', 'key')).toBeUndefined();
  });

  it('uses lynx-only Web information for destruction and bypasses the Native update bridge', () => {
    const engine = createMockContextProxy();
    const getNative = vi.fn();
    const getJSContext = vi.fn();
    hostGlobal.lynx = {
      SystemInfo: { platform: 'web' },
      getEngine: () => engine,
      getNative,
      getJSContext,
    };
    const destroy = vi.fn();
    onDestroy(destroy);
    expect(getNative).not.toHaveBeenCalled();
    expect(getJSContext).not.toHaveBeenCalled();
    engine.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('reads SystemInfo without reinstalling aliases and suppresses performance during and after destruction', () => {
    const native = createMockContextProxy();
    const info = { platform: 'android' };
    const perf = {
      _generatePipelineOptions: vi.fn(() => ({ pipelineID: 'unused' })),
      _markTiming: vi.fn(),
    };
    hostGlobal.lynx = {
      SystemInfo: info,
      performance: perf,
      getNative: () => native,
    };
    expect(getSystemInfo()).toBe(info);
    const check = () => {
      delete hostGlobal.SystemInfo;
      expect(getSystemInfo()).toBe(info);
      expect(hostGlobal.SystemInfo).toBeUndefined();
      expect(createPipeline({ timingFlag: 'late' })).toBeUndefined();
      expect(markTiming('pipeline', 'late')).toBeUndefined();
      expect(perf._generatePipelineOptions).not.toHaveBeenCalled();
      expect(perf._markTiming).not.toHaveBeenCalled();
    };
    onDestroy(check);
    native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    check();
  });

  it('populates the original pipeline, preserves host fields, starts before binding, and keeps performance this', () => {
    const pipeline = {
      pipelineID: 'mts',
      pipelineOrigin: 'default',
      needTimestamps: true,
      hostMetadata: 1,
    };
    const perf = {
      _generatePipelineOptions: vi.fn(() => pipeline),
      _onPipelineStart: vi.fn(),
      _bindPipelineIDWithTimingFlag: vi.fn(),
      _bindPipelineIdWithTimingFlag: vi.fn(),
      _markTiming: vi.fn(),
    };
    hostGlobal.lynx!.performance = perf;
    const options = Object.freeze({
      pipelineOrigin: 'update',
      needTimestamps: false,
      timingFlag: 'flag',
      dsl: 'independent',
      stage: 'render',
    });
    const result = createPipeline(options);
    expect(result).toBe(pipeline);
    expect(result).toEqual({
      pipelineID: 'mts',
      pipelineOrigin: 'update',
      needTimestamps: false,
      hostMetadata: 1,
      dsl: 'independent',
      stage: 'render',
    });
    expect(perf._onPipelineStart).toHaveBeenCalledExactlyOnceWith(
      'mts',
      'update',
    );
    expect(perf._bindPipelineIDWithTimingFlag).toHaveBeenCalledExactlyOnceWith(
      'mts',
      'flag',
    );
    expect(perf._bindPipelineIdWithTimingFlag).not.toHaveBeenCalled();
    expect(perf._onPipelineStart.mock.invocationCallOrder[0]).toBeLessThan(
      perf._bindPipelineIDWithTimingFlag.mock.invocationCallOrder[0]!,
    );
    markTiming(result, 'mtsRenderStart');
    markTiming('mts', 'detail');
    expect(perf._markTiming.mock.calls).toEqual([['mts', 'mtsRenderStart'], [
      'mts',
      'detail',
    ]]);
    for (
      const method of [
        perf._generatePipelineOptions,
        perf._onPipelineStart,
        perf._bindPipelineIDWithTimingFlag,
        perf._markTiming,
      ]
    ) {
      expect(method.mock.contexts.every(context => context === perf)).toBe(
        true,
      );
    }
  });

  it.each([undefined, '', 'host-origin', 3])(
    'uses the MTS start signature for generated origin %s',
    origin => {
      const pipeline = { pipelineID: 'mts', pipelineOrigin: origin };
      const start = vi.fn();
      hostGlobal.lynx!.performance = {
        _generatePipelineOptions: () => pipeline,
        _onPipelineStart: start,
      };
      expect(createPipeline()).toBe(pipeline);
      expect(start.mock.calls).toEqual(
        typeof origin === 'string' && origin.length > 0
          ? [['mts', origin]]
          : [['mts']],
      );
    },
  );

  it('preserves omitted fields, accepts explicit empty strings and supports the alternate timing binder', () => {
    const pipeline = {
      pipelineID: 'mts',
      pipelineOrigin: 'host',
      needTimestamps: true,
      dsl: 'host',
      stage: 'host',
    };
    const bind = vi.fn();
    const start = vi.fn();
    hostGlobal.lynx!.performance = {
      _generatePipelineOptions: () => pipeline,
      _onPipelineStart: start,
      _bindPipelineIdWithTimingFlag: bind,
    };
    createPipeline({
      needTimestamps: undefined,
      pipelineOrigin: undefined,
      dsl: undefined,
      stage: undefined,
    });
    expect(pipeline).toEqual({
      pipelineID: 'mts',
      pipelineOrigin: 'host',
      needTimestamps: true,
      dsl: 'host',
      stage: 'host',
    });
    createPipeline({
      pipelineOrigin: '',
      dsl: '',
      stage: '',
      timingFlag: 'fallback',
    });
    expect(start).toHaveBeenLastCalledWith('mts');
    expect(bind).toHaveBeenCalledExactlyOnceWith('mts', 'fallback');
    createPipeline({ timingFlag: '' });
    expect(bind).toHaveBeenCalledTimes(1);
    expect(pipeline.dsl).toBe('');
    expect(pipeline.stage).toBe('');
  });

  it('tolerates missing optional performance methods and invalid generated pipelines', () => {
    expect(createPipeline()).toBeUndefined();
    expect(markTiming('id', 'key')).toBeUndefined();
    const start = vi.fn();
    const bind = vi.fn();
    const perf: HostPerformanceObject = {
      _onPipelineStart: start,
      _bindPipelineIDWithTimingFlag: bind,
    };
    hostGlobal.lynx!.performance = perf;
    expect(createPipeline()).toBeUndefined();
    for (
      const result of [undefined, null, 2, 'id', {}, [], { pipelineID: '' }, {
        pipelineID: 1,
      }]
    ) {
      perf._generatePipelineOptions = () => result;
      expect(createPipeline({ timingFlag: 'flag' })).toBeUndefined();
    }
    expect(start).not.toHaveBeenCalled();
    expect(bind).not.toHaveBeenCalled();
    hostGlobal.lynx!.performance = {
      _generatePipelineOptions: () => ({ pipelineID: 'minimal' }),
    };
    expect(createPipeline({ timingFlag: 'flag' })).toEqual({
      pipelineID: 'minimal',
    });
    expect(markTiming('minimal', 'key')).toBeUndefined();
  });

  it('ignores absent IDs and empty timing keys without filtering needTimestamps', () => {
    const mark = vi.fn();
    hostGlobal.lynx!.performance = { _markTiming: mark };
    for (const pipeline of [undefined, {}, '', { pipelineID: '' }]) {
      markTiming(pipeline, 'key');
    }
    markTiming('valid', '');
    expect(mark).not.toHaveBeenCalled();
    markTiming({ pipelineID: 'valid', needTimestamps: false }, 'always');
    expect(mark).toHaveBeenCalledExactlyOnceWith('valid', 'always');
  });

  it.each(
    [
      '_generatePipelineOptions',
      '_onPipelineStart',
      '_bindPipelineIDWithTimingFlag',
      '_markTiming',
    ] as const,
  )('propagates host %s errors', method => {
    const failure = new Error(method);
    const perf: HostPerformanceObject = {
      _generatePipelineOptions: () => ({ pipelineID: 'mts' }),
    };
    perf[method] = () => {
      throw failure;
    };
    hostGlobal.lynx!.performance = perf;
    expect(() =>
      method === '_markTiming'
        ? markTiming('mts', 'key')
        : createPipeline({ timingFlag: 'flag' })
    ).toThrow(failure);
  });
});
