// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import * as services from '../src/bts.js';
import { bindPage } from '../src/bts.js';
import { NATIVE_EVENT_DESTROY_LIFETIME } from '../src/common/protocol.js';
import type {
  HostBTSApp,
  HostContextProxy,
  HostGlobalEventEmitter,
  HostGlobalScope,
  HostMessageEvent,
  HostPerformanceObject,
  LynxSystemInfo,
} from '../src/common/types.js';

const hostGlobal = globalThis as unknown as HostGlobalScope;

afterEach(() => {
  delete hostGlobal.lynx;
  delete hostGlobal.tt;
  delete hostGlobal.currentAppId;
  delete hostGlobal.multiApps;
  delete hostGlobal.SystemInfo;
});

describe('BTS runtime functions', () => {
  it('has zero module-evaluation side effects on tt until bindPage is called', async () => {
    vi.resetModules();
    const onAppReload = vi.fn();
    const callDestroyLifetimeFun = vi.fn();
    const app: HostBTSApp = {
      _params: { initData: { a: 1 } },
      onAppReload,
      callDestroyLifetimeFun,
    };
    hostGlobal.tt = app;

    const freshBts = await import('../src/bts.js');
    expect(app.onAppReload).toBe(onAppReload);
    expect(app.callDestroyLifetimeFun).toBe(callDestroyLifetimeFun);

    const card = freshBts.bindPage();
    expect(card.getInitData()).toEqual({ a: 1 });
    expect(app.onAppReload).not.toBe(onAppReload);
    expect(app.callDestroyLifetimeFun).not.toBe(callDestroyLifetimeFun);
  });

  it('requires a card for messages even when the peer proxy exists', () => {
    const proxy = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    hostGlobal.lynx = { getCoreContext: () => proxy };

    expect(() => services.bindPage().sendMessage('test', {})).toThrow(
      'Unable to resolve BTS App instance',
    );
    expect(() => services.bindPage().onMessage('test', vi.fn())).toThrow(
      'Unable to resolve BTS App instance',
    );
    expect(proxy.dispatchEvent).not.toHaveBeenCalled();
    expect(proxy.addEventListener).not.toHaveBeenCalled();
  });

  const notifications = [
    {
      api: 'onGlobalPropsChanged',
      emit: (app: HostBTSApp) => app.updateGlobalProps?.({ count: 1 }),
    },
    {
      api: 'onUpdateData',
      emit: (app: HostBTSApp) => app.updateCardData?.({ count: 1 }),
    },
    {
      api: 'onReload',
      emit: (app: HostBTSApp) => app.onAppReload?.({ count: 1 }),
    },
    {
      api: 'onConfigChanged',
      emit: (app: HostBTSApp) => app.processCardConfig?.({ count: 1 }),
    },
    {
      api: 'onEnterForeground',
      emit: (app: HostBTSApp) => app.onAppEnterForeground?.(),
    },
    {
      api: 'onEnterBackground',
      emit: (app: HostBTSApp) => app.onAppEnterBackground?.(),
    },
  ] as const;
  it.each(notifications)(
    'deduplicates $api across repeated bindings without retaining stale disposers',
    ({ api, emit }) => {
      const app: HostBTSApp = { _params: { cardType: 'react_nodiff' } };
      hostGlobal.tt = app;
      const card = bindPage();
      const listener = vi.fn();
      const other = vi.fn();
      const stop = bindPage()[api](listener);
      const duplicateStop = card[api](listener);
      const stopOther = card[api](other);
      expect(duplicateStop).toBe(stop);
      emit(app);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);

      duplicateStop();
      emit(app);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(2);

      const stopNew = card[api](listener);
      stop();
      duplicateStop();
      emit(app);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(3);
      stopOther();
      emit(app);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(other).toHaveBeenCalledTimes(3);

      stopNew();
      stopNew();
      emit(app);
      expect(listener).toHaveBeenCalledTimes(3);
      const stopLast = card[api](listener);
      const stopManualCleanup = card.onDestroy(stopLast);
      stopManualCleanup();
      app.callDestroyLifetimeFun?.();
      emit(app);
      expect(listener).toHaveBeenCalledTimes(3);
      stopLast();
      stopLast();
    },
  );

  it.each([false, true])(
    'deduplicates destruction callbacks and allows either disposer to remove them (cancel: %s)',
    cancel => {
      const app: HostBTSApp = {};
      hostGlobal.tt = app;
      const card = bindPage();
      const listener = vi.fn();
      const other = vi.fn();
      const stop = bindPage().onDestroy(listener);
      const duplicateStop = card.onDestroy(listener);
      expect(duplicateStop).toBe(stop);
      card.onDestroy(other);
      if (cancel) {
        duplicateStop();
        stop();
      }
      const capturedDestroy = app.callDestroyLifetimeFun;
      capturedDestroy?.();
      expect(listener).toHaveBeenCalledTimes(cancel ? 0 : 1);
      expect(other).toHaveBeenCalledTimes(1);
      capturedDestroy?.();
      stop();
      duplicateStop();
      expect(listener).toHaveBeenCalledTimes(cancel ? 0 : 1);
      expect(other).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps callback identity independent for each card and notification', () => {
    const first: HostBTSApp = {};
    const second: HostBTSApp = {};
    hostGlobal.multiApps = { first, second };
    hostGlobal.currentAppId = 'first';
    const firstCard = bindPage();
    hostGlobal.currentAppId = 'second';
    const secondCard = bindPage();
    const listener = vi.fn();
    const stop = firstCard.onEnterForeground(listener);
    firstCard.onEnterBackground(listener);
    secondCard.onEnterForeground(listener);
    first.onAppEnterForeground?.();
    first.onAppEnterBackground?.();
    second.onAppEnterForeground?.();
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    first.onAppEnterForeground?.();
    first.onAppEnterBackground?.();
    second.onAppEnterForeground?.();
    expect(listener).toHaveBeenCalledTimes(5);
    first.callDestroyLifetimeFun?.();
    first.onAppEnterBackground?.();
    second.onAppEnterForeground?.();
    expect(listener).toHaveBeenCalledTimes(6);
    second.callDestroyLifetimeFun?.();
  });

  it('merges static data and Native-processed initial data, keeps getInitData read-only without overwriting DSL __initData, syncs reload/globalProps even with pre-existing own callbacks, and does not short-circuit C++ BTSRuntime::Destroy', () => {
    const initialUpdateData = { processed: true, count: 1 };
    const nativeListeners = new Map<
      string,
      Set<(event: HostMessageEvent) => void>
    >();
    const nativeProxy: HostContextProxy = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(
        <T = unknown>(
          type: string,
          listener: (event: HostMessageEvent<T>) => void,
        ) => {
          let set = nativeListeners.get(type);
          if (!set) {
            set = new Set();
            nativeListeners.set(type, set);
          }
          set.add(listener as (event: HostMessageEvent) => void);
        },
      ),
      removeEventListener: vi.fn(
        <T = unknown>(
          type: string,
          listener: (event: HostMessageEvent<T>) => void,
        ) => {
          nativeListeners
            .get(type)
            ?.delete(listener as (event: HostMessageEvent) => void);
        },
      ),
    };

    const existingUpdateGlobalProps = vi.fn();
    const existingReload = vi.fn();
    const existingDestroySpy = vi.fn();
    const app: HostBTSApp = {
      nativeAppId: 'card-42',
      _params: {
        appGUID: 'guid-42',
        cardType: 'react_nodiff',
        initData: { raw: true, fromTemplate: 'yes', count: 0 },
        updateData: initialUpdateData,
      },
      lynx: {
        __initData: { dslState: 'initial' },
        __globalProps: { appVer: '1.0.0' },
        getNative: () => nativeProxy,
      },
      updateGlobalProps: existingUpdateGlobalProps,
      onAppReload: existingReload,
      callDestroyLifetimeFun: existingDestroySpy,
    };

    // Simulate real lynx-core pageGlobal (no globalThis.lynx / globalThis.tt, bound via multiApps[currentAppId]):
    hostGlobal.currentAppId = 'card-42';
    hostGlobal.multiApps = { 'card-42': app };

    expect(bindPage().getId()).toBe('guid-42');
    // Native-processed data overlays static template data; Runtime does not execute processors:
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      processed: true,
      count: 1,
    });

    // Simulate DSL updating lynx.__initData on incremental update; read-only bindPage().getInitData() must NOT overwrite it:
    app.lynx!.__initData = { dslState: 'updated-by-dsl', count: 42 };
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      processed: true,
      count: 1,
    });
    expect(app.lynx!.__initData).toEqual({
      dslState: 'updated-by-dsl',
      count: 42,
    });

    expect(bindPage().getGlobalProps()).toEqual({ appVer: '1.0.0' });

    // Even when app already has an own updateGlobalProps callback and no onGlobalPropsChanged subscriber is registered,
    // bindPage().getGlobalProps() stays synced and the pre-existing own callback is invoked:
    app.updateGlobalProps?.({ appVer: '1.1.0' });
    expect(existingUpdateGlobalProps).toHaveBeenCalledWith({ appVer: '1.1.0' });
    expect(bindPage().getGlobalProps()).toEqual({ appVer: '1.1.0' });

    // Even before subscribing to onAppReload, pre-existing own onAppReload callback runs and syncs bindPage().getInitData():
    app.onAppReload?.(
      { reloaded: 0, count: 5 },
      { processorName: 'preSubReloadProc' },
    );
    expect(existingReload).toHaveBeenCalledWith(
      { reloaded: 0, count: 5 },
      { processorName: 'preSubReloadProc' },
    );
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      count: 5,
      reloaded: 0,
    });

    const reloadSpy = vi.fn(() => {
      // Inside onAppReload callback, bindPage().getInitData() overlays reload data onto static _params.initData without retaining prior dynamic keys:
      expect(bindPage().getInitData()).toEqual({
        raw: true,
        fromTemplate: 'yes',
        count: 10,
        reloaded: 1,
      });
    });
    const configSpy = vi.fn();
    const fgSpy = vi.fn();
    const bgSpy = vi.fn();
    const destroySpy = vi.fn();

    const unsubReload = bindPage().onReload(reloadSpy);
    bindPage().onConfigChanged(configSpy);
    bindPage().onEnterForeground(fgSpy);
    bindPage().onEnterBackground(bgSpy);
    bindPage().onDestroy(destroySpy);

    // Forward second argument options ({ processorName }) from C++ App::OnAppReload and sync bindPage().getInitData():
    app.onAppReload?.(
      { reloaded: 1, count: 10 },
      { processorName: 'reloadProc' },
    );
    expect(reloadSpy).toHaveBeenCalledWith(
      { reloaded: 1, count: 10 },
      { processorName: 'reloadProc' },
    );
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      count: 10,
      reloaded: 1,
    });

    // After unsubscribing onAppReload, subsequent reload still syncs bindPage().getInitData() and runs pre-existing own callback:
    unsubReload();
    app.onAppReload?.(
      { count: 20 },
      { processorName: 'postUnsubReloadProc' },
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      count: 20,
    });
    app.onAppReload?.(undefined as unknown as Record<string, unknown>);
    expect(bindPage().getInitData()).toEqual({
      raw: true,
      fromTemplate: 'yes',
      count: 0,
    });

    app.processCardConfig?.({ themeConfig: 'a' });
    expect(configSpy).toHaveBeenCalledWith({ themeConfig: 'a' });

    app.onAppEnterForeground?.();
    expect(fgSpy).toHaveBeenCalledTimes(1);

    app.onAppEnterBackground?.();
    expect(bgSpy).toHaveBeenCalledTimes(1);

    // Simulate C++ BTSRuntime::Destroy (`if (nativeProxy.HasEventListener("__DestroyLifetime")) ... else app.callDestroyLifetimeFun()`):
    if ((nativeListeners.get(NATIVE_EVENT_DESTROY_LIFETIME)?.size ?? 0) > 0) {
      for (const fn of nativeListeners.get(NATIVE_EVENT_DESTROY_LIFETIME)!) {
        fn({ type: NATIVE_EVENT_DESTROY_LIFETIME, data: undefined });
      }
    } else {
      app.callDestroyLifetimeFun?.();
    }

    // Both pre-existing tt.callDestroyLifetimeFun and bts.bindPage().onDestroy must run, and pre-existing own slots are restored:
    expect(existingDestroySpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(app.updateGlobalProps).toBe(existingUpdateGlobalProps);
    expect(app.onAppReload).toBe(existingReload);

    // Listeners are cleaned up on destroy and original slot is restored:
    app.onAppEnterForeground?.();
    expect(fgSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps captured handles bound to their cards across repeated bindPage() calls, and preserves globalProps sync with pre-existing own callback after unsubscribe', () => {
    hostGlobal.lynx = { __globalProps: { theme: 'host-shared' } };

    const prevUpdateGlobalProps = vi.fn(
      (next: Record<string, unknown> | undefined) => {
        // The Runtime snapshot is updated before the pre-existing callback runs:
        expect(card1.getGlobalProps()).toEqual(next);
      },
    );
    const app1: HostBTSApp = {
      _params: { appGUID: 'card-1', cardType: 'react_nodiff' },
      lynx: { __globalProps: { theme: 'light' } },
      updateGlobalProps: prevUpdateGlobalProps,
    };
    const app2: HostBTSApp = {
      _params: { appGUID: 'card-2', cardType: 'react_nodiff' },
      lynx: { __globalProps: { theme: 'card2-initial' } },
    };

    hostGlobal.multiApps = { 'card-1': app1 };
    hostGlobal.currentAppId = 'card-1';
    const card1 = bindPage();

    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const unsub1 = bindPage().onGlobalPropsChanged(spy1);
    const unsub2 = bindPage().onGlobalPropsChanged(spy2);

    // Simulate card-2 loading in the same LynxGroup and calling bindPage():
    hostGlobal.multiApps['card-2'] = app2;
    hostGlobal.currentAppId = 'card-2';
    const card2 = bindPage();

    expect(bindPage()).toBe(card2);
    hostGlobal.currentAppId = 'card-1';
    expect(bindPage()).toBe(card1);
    hostGlobal.currentAppId = 'card-2';
    expect(card1.getId()).toBe('card-1');
    expect(card2.getId()).toBe('card-2');

    app1.updateGlobalProps?.({ theme: 'dark' });
    expect(prevUpdateGlobalProps).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledWith({ theme: 'dark' });
    expect(spy2).toHaveBeenCalledWith({ theme: 'dark' });
    expect(card1.getGlobalProps()).toEqual({ theme: 'dark' });
    expect(card1.getGlobalProps()).toEqual({ theme: 'dark' });
    expect(card2.getGlobalProps()).toEqual({ theme: 'card2-initial' });

    // Updating app1 must NOT pollute hostGlobal.lynx.__globalProps or card-2:
    expect(hostGlobal.lynx.__globalProps).toEqual({ theme: 'host-shared' });

    // Out-of-order unsubscribe (unsub1 first, then unsub2) keeps automatic sync active on app1 while card-1 is alive:
    unsub1();
    unsub2();
    app1.updateGlobalProps?.({ theme: 'card1-after-unsub' });
    expect(prevUpdateGlobalProps).toHaveBeenCalledTimes(2);
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(card1.getGlobalProps()).toEqual({ theme: 'card1-after-unsub' });

    // On card-2, getGlobalProps also continues to work after onGlobalPropsChanged unsubscribes:
    const unsubApp2 = card2.onGlobalPropsChanged(vi.fn());
    unsubApp2();
    app2.updateGlobalProps?.({ theme: 'card2-after-unsub' });
    expect(card2.getGlobalProps()).toEqual({ theme: 'card2-after-unsub' });

    // When card-1 is destroyed, its original own updateGlobalProps callback is restored while card-2 remains active:
    app1.callDestroyLifetimeFun?.();
    expect(app1.updateGlobalProps).toBe(prevUpdateGlobalProps);
    expect(bindPage().getId()).toBe('card-2');
  });

  it('consumes tt.updateCardData directly across cardTypes without requiring getCoreContext, and runs all destroy cleanups even if a destroy listener throws', () => {
    const initialData = { a: 0 };
    const prevUpdateCardData = vi.fn();
    const app1: HostBTSApp = {
      _params: {
        appGUID: 'card-1',
        cardType: 'react_nodiff',
        updateData: initialData,
      },
      lynx: { __initData: { dslState: true } },
      updateCardData: prevUpdateCardData,
    };
    const app2: HostBTSApp = {
      _params: { appGUID: 'card-2', cardType: 'react' },
      lynx: { __initData: { card: 2 } },
    };

    hostGlobal.multiApps = { 'card-1': app1, 'card-2': app2 };
    hostGlobal.currentAppId = 'card-1';
    const card1 = bindPage();

    bindPage().onDestroy(() => {
      throw new Error('bts destroy error');
    });

    const received1: Array<{ data: unknown; options: unknown }> = [];
    const unsub1 = bindPage().onUpdateData((data, options) => {
      received1.push({ data, options });
    });
    const afterThrowDestroySpy = vi.fn();
    bindPage().onDestroy(afterThrowDestroySpy);

    hostGlobal.currentAppId = 'card-2';
    const card2 = bindPage();
    const received2 = vi.fn();
    const unsub2 = card2.onUpdateData(received2);
    expect(typeof app2.updateCardData).toBe('function');
    app2.updateCardData?.({ c: 3 });
    expect(received2).toHaveBeenCalledExactlyOnceWith({ c: 3 }, {
      resetPageData: false,
      processorName: undefined,
    });
    unsub2();
    expect(app2.updateCardData).toBeUndefined();

    // Merely binding the card does not claim the independent GlobalProps capability.
    expect(app1.updateGlobalProps).toBeUndefined();
    expect(typeof app1.onAppReload).toBe('function');

    app1.updateCardData?.({ b: 2 }, { type: 1, processorName: 'pReset' });
    app1.updateCardData?.({ d: 4 }, { type: 0, processorName: 'pLive' });

    expect(prevUpdateCardData).toHaveBeenCalledTimes(2);
    expect(received1).toEqual([
      {
        data: { b: 2 },
        options: { resetPageData: true, processorName: 'pReset' },
      },
      {
        data: { d: 4 },
        options: { resetPageData: false, processorName: 'pLive' },
      },
    ]);
    // Incremental updateCardData does not mutate initial data snapshot:
    expect(card1.getInitData()).toEqual(initialData);

    expect(() => app1.callDestroyLifetimeFun?.()).toThrow('bts destroy error');
    expect(afterThrowDestroySpy).toHaveBeenCalledTimes(1);
    expect(app1.updateCardData).toBe(prevUpdateCardData);
    // Reading a retained handle must not install a new capability on a dead card.
    expect(card1.getGlobalProps()).toEqual({});
    expect(card1.getGlobalProps()).toBe(card1.getGlobalProps());
    expect(app1.updateGlobalProps).toBeUndefined();

    unsub1();
  });

  it('uses direct host updates on Web even with the legacy react cardType', () => {
    const app: HostBTSApp = {
      _params: { appGUID: 'web-card', cardType: 'react' },
    };
    hostGlobal.SystemInfo = { platform: 'web' };
    const getCoreContext = vi.fn(() => {
      throw new Error('unexpected forwarding');
    });
    hostGlobal.lynx = { getApp: () => app, getCoreContext };
    const card = bindPage();
    const listener = vi.fn();
    card.onUpdateData(listener);
    app.updateCardData?.({ count: 1 });
    app.updateCardData?.({ count: 2 }, { type: 1 });
    expect(listener.mock.calls).toEqual([
      [{ count: 1 }, { resetPageData: false, processorName: undefined }],
      [{ count: 2 }, { resetPageData: true, processorName: undefined }],
    ]);
    expect(getCoreContext).not.toHaveBeenCalled();
    app.callDestroyLifetimeFun?.();
    expect(app.updateCardData).toBeUndefined();
  });

  it.each([
    { sharedHost: false, wrapDestroy: false },
    { sharedHost: true, wrapDestroy: false },
    { sharedHost: false, wrapDestroy: true },
    { sharedHost: true, wrapDestroy: true },
  ])(
    'keeps the dying card bound through callbacks and final cleanup ($sharedHost, wrapped: $wrapDestroy)',
    ({ sharedHost, wrapDestroy }) => {
      const app1: HostBTSApp = {
        _params: {
          appGUID: 'destroying-card',
          cardType: 'react_nodiff',
          initData: { initial: 'card-1' },
        },
        lynx: { __globalProps: { theme: 'card-1' } },
        callDestroyLifetimeFun: vi.fn(() => {
          expect(card1.getId()).toBe('destroying-card');
        }),
      };
      const app2: HostBTSApp = {
        _params: { appGUID: 'next-card', cardType: 'react_nodiff' },
      };
      if (sharedHost) {
        hostGlobal.multiApps = { 'card-1': app1, 'card-2': app2 };
        hostGlobal.currentAppId = 'card-1';
      } else {
        hostGlobal.lynx = { getApp: () => app1 };
      }
      const originalDestroy = app1.callDestroyLifetimeFun;
      const card1 = bindPage();
      const capturedDestroy = app1.callDestroyLifetimeFun;
      const hostWrapper = () => capturedDestroy?.();
      if (wrapDestroy) {
        app1.callDestroyLifetimeFun = hostWrapper;
      }
      const seenIds: string[] = [];
      bindPage().onDestroy(() => {
        seenIds.push(card1.getId());
        expect(card1.getInitData()).toEqual({ initial: 'card-1' });
        expect(card1.getGlobalProps()).toEqual({ theme: 'card-1' });
        expect(card1.getId()).toBe('destroying-card');
        if (sharedHost) {
          expect(bindPage().getId()).toBe('next-card');
          expect(card1.getId()).toBe('destroying-card');
        }
        throw new Error('destroy callback failed');
      });
      bindPage().onDestroy(() => {
        seenIds.push(card1.getId());
      });

      if (sharedHost) {
        hostGlobal.currentAppId = 'card-2';
        bindPage();
        // Native may detach the dying card before delivering its final notification.
        delete hostGlobal.multiApps!['card-1'];
      }

      expect(() => app1.callDestroyLifetimeFun?.()).toThrow(
        'destroy callback failed',
      );
      expect(seenIds).toEqual(['destroying-card', 'destroying-card']);
      expect(app1.callDestroyLifetimeFun).toBe(
        wrapDestroy ? hostWrapper : originalDestroy,
      );
      expect(app1.updateGlobalProps).toBeUndefined();
      expect(app1.onAppReload).toBeUndefined();
      if (sharedHost) {
        expect(bindPage().getId()).toBe('next-card');
      }
    },
  );
  it.each(['react', 'react_nodiff'])(
    'rejects all new registrations during and after %s card destruction without reviving host hooks',
    (cardType) => {
      const proxy = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      const app: HostBTSApp = {
        nativeAppId: 'last-card',
        _params: { appGUID: 'final-guid', cardType, initData: { seed: 1 } },
        lynx: {
          __globalProps: { theme: 'final' },
          getCoreContext: () => proxy,
        },
      };
      hostGlobal.tt = app;
      const card = bindPage();
      const stop = card.onEnterForeground(vi.fn());
      const registrations = [
        () => card.onUpdateData(vi.fn()),
        () => card.onGlobalPropsChanged(vi.fn()),
        () => card.onReload(vi.fn()),
        () => card.onConfigChanged(vi.fn()),
        () => card.onEnterForeground(vi.fn()),
        () => card.onEnterBackground(vi.fn()),
        () => card.onGlobalEvent('evt', vi.fn()),
        () => card.onDestroy(vi.fn()),
        () => card.setEventHandler(vi.fn()),
        () => bindPage().onDestroy(vi.fn()),
      ];
      const check = () => {
        for (const register of registrations) {
          expect(register).toThrow(/destroying or destroyed/);
        }
        expect(card.getInitData()).toEqual({ seed: 1 });
        expect(card.getId()).toBe('final-guid');
        expect(card.getGlobalProps()).toEqual({ theme: 'final' });
        expect(app.updateGlobalProps).toBeUndefined();
        stop();
        stop();
      };
      card.onDestroy(check);
      app.callDestroyLifetimeFun?.();
      delete app._params;
      app.lynx!.__globalProps = { theme: 'changed after destroy' };
      check();
      expect(proxy.addEventListener).not.toHaveBeenCalled();
      expect(proxy.dispatchEvent).not.toHaveBeenCalled();
      expect(app.onAppEnterForeground).toBeUndefined();
      expect(app.updateCardData).toBeUndefined();
    },
  );
});

describe('BTS host services', () => {
  it('reads host info through a bound card, retaining object identity', () => {
    hostGlobal.tt = { lynx: {} };
    const globalInfo = {
      platform: 'global',
      lynxSdkVersion: '3.1',
      deviceMode: 'tablet',
    };
    const lynxInfo = { platform: 'lynx' };
    hostGlobal.SystemInfo = globalInfo;
    hostGlobal.lynx = { SystemInfo: lynxInfo };
    expect(services.bindPage().getSystemInfo()).toBe(globalInfo);
    expect(services.bindPage().getSystemInfo()['deviceMode']).toBe(
      'tablet',
    );
    delete hostGlobal.SystemInfo;
    expect(services.bindPage().getSystemInfo()).toBe(lynxInfo);
    delete hostGlobal.lynx.SystemInfo;
    expect(services.bindPage().getSystemInfo()).toEqual({});
    expectTypeOf<import('../src/bts.js').LynxSystemInfo>().toEqualTypeOf<
      import('../src/index.js').LynxSystemInfo
    >();
    expectTypeOf<import('../src/bts.js').CreatePipelineOptions>().toEqualTypeOf<
      import('../src/index.js').CreatePipelineOptions
    >();
  });

  it('resolves card info before global and host info, ignoring non-plain candidates', () => {
    const cardInfo = { platform: 'card' };
    const globalInfo = { platform: 'global' };
    const hostInfo = { platform: 'host' };
    const app: HostBTSApp = { lynx: { SystemInfo: cardInfo } };
    hostGlobal.tt = app;
    hostGlobal.SystemInfo = globalInfo;
    hostGlobal.lynx = { SystemInfo: hostInfo };
    const card = services.bindPage();
    expect(card.getSystemInfo()).toBe(cardInfo);
    expect(services.bindPage().getSystemInfo()).toBe(cardInfo);
    for (const invalid of [null, [], 3, new Date()]) {
      app.lynx!.SystemInfo = invalid as unknown as LynxSystemInfo;
      expect(card.getSystemInfo()).toBe(globalInfo);
      hostGlobal.SystemInfo = invalid as unknown as LynxSystemInfo;
      expect(card.getSystemInfo()).toBe(hostInfo);
      hostGlobal.lynx.SystemInfo = invalid as unknown as LynxSystemInfo;
      expect(card.getSystemInfo()).toEqual({});
      hostGlobal.SystemInfo = globalInfo;
      hostGlobal.lynx.SystemInfo = hostInfo;
    }
  });

  it('normalizes missing update data to an empty record on direct updates', () => {
    const app: HostBTSApp = {
      _params: { cardType: 'react' },
      lynx: { SystemInfo: { platform: 'web' } },
    };
    hostGlobal.tt = app;
    const listener = vi.fn();
    services.bindPage().onUpdateData(listener);
    (app.updateCardData as ((data?: Record<string, unknown>) => void))?.(
      undefined,
    );
    expect(listener).toHaveBeenCalledExactlyOnceWith({}, {
      resetPageData: false,
      processorName: undefined,
    });
  });

  it.each(
    [
      ['2.14.1', false],
      ['3.0', false],
      ['3.0.9', false],
      ['3.1.0', true],
      ['4.0', true],
      [undefined, false],
    ] as const,
  )('uses SDK %s to select the BTS start signature', (version, modern) => {
    const pipeline = { pipelineID: 'bts', pipelineOrigin: 'host' };
    const start = vi.fn();
    hostGlobal.tt = {
      lynx: {
        SystemInfo: { lynxSdkVersion: version },
        performance: {
          _generatePipelineOptions: () => pipeline,
          _onPipelineStart: start,
        },
      },
    };
    // Card information is authoritative, even when it has no version field.
    hostGlobal.SystemInfo = { lynxSdkVersion: '9.0' };
    expect(services.bindPage().createPipeline()).toBe(pipeline);
    expect(start.mock.calls).toEqual(modern ? [['bts', pipeline]] : [['bts']]);
  });

  it('uses host version and performance for a lightweight bound card', () => {
    hostGlobal.tt = {};
    const pipeline = { pipelineID: 'lightweight' };
    const perf = {
      _generatePipelineOptions: vi.fn(() => pipeline),
      _onPipelineStart: vi.fn(),
      _markTiming: vi.fn(),
    };
    hostGlobal.lynx = {
      performance: perf,
      SystemInfo: { lynxSdkVersion: '3.1' },
    };
    expect(services.bindPage().createPipeline()).toBe(pipeline);
    expect(perf._onPipelineStart).toHaveBeenCalledExactlyOnceWith(
      'lightweight',
      pipeline,
    );
    services.bindPage().markTiming(pipeline, 'key');
    expect(perf._markTiming).toHaveBeenCalledExactlyOnceWith(
      'lightweight',
      'key',
    );
  });

  it('fills the original pipeline and prefers Id binding while preserving method this', () => {
    const pipeline = {
      pipelineID: 'bts',
      needTimestamps: true,
      metadata: 'host',
    };
    const perf = {
      _generatePipelineOptions: vi.fn(() => pipeline),
      _onPipelineStart: vi.fn(),
      _bindPipelineIdWithTimingFlag: vi.fn(),
      _bindPipelineIDWithTimingFlag: vi.fn(),
      _markTiming: vi.fn(),
    };
    hostGlobal.tt = {
      lynx: { performance: perf, SystemInfo: { lynxSdkVersion: '4.2' } },
    };
    const card = services.bindPage();
    expect(
      card.createPipeline(
        Object.freeze({
          pipelineOrigin: 'update',
          needTimestamps: false,
          timingFlag: 'flag',
          dsl: 'custom',
          stage: 'render',
        }),
      ),
    ).toBe(pipeline);
    expect(pipeline).toEqual({
      pipelineID: 'bts',
      pipelineOrigin: 'update',
      needTimestamps: false,
      dsl: 'custom',
      stage: 'render',
      metadata: 'host',
    });
    expect(perf._onPipelineStart).toHaveBeenCalledExactlyOnceWith(
      'bts',
      pipeline,
    );
    expect(perf._bindPipelineIdWithTimingFlag).toHaveBeenCalledExactlyOnceWith(
      'bts',
      'flag',
    );
    expect(perf._bindPipelineIDWithTimingFlag).not.toHaveBeenCalled();
    card.markTiming(pipeline, 'always');
    expect(perf._markTiming).toHaveBeenCalledExactlyOnceWith('bts', 'always');
    for (
      const method of [
        perf._generatePipelineOptions,
        perf._onPipelineStart,
        perf._bindPipelineIdWithTimingFlag,
        perf._markTiming,
      ]
    ) {
      expect(method.mock.contexts.every(context => context === perf)).toBe(
        true,
      );
    }
  });

  it('uses ID binding as a fallback and does not bind omitted or empty flags', () => {
    hostGlobal.tt = {};
    const bind = vi.fn();
    const pipeline = {
      pipelineID: 'bts',
      needTimestamps: true,
      pipelineOrigin: 'host',
      dsl: 'host',
      stage: 'host',
    };
    hostGlobal.lynx = {
      performance: {
        _generatePipelineOptions: () => pipeline,
        _bindPipelineIDWithTimingFlag: bind,
      },
    };
    services.bindPage().createPipeline();
    services.bindPage().createPipeline({ timingFlag: '' });
    expect(bind).not.toHaveBeenCalled();
    services.bindPage().createPipeline({
      timingFlag: 'fallback',
      pipelineOrigin: '',
      dsl: '',
      stage: '',
      needTimestamps: false,
    });
    expect(bind).toHaveBeenCalledExactlyOnceWith('bts', 'fallback');
    expect(pipeline).toEqual({
      pipelineID: 'bts',
      needTimestamps: false,
      pipelineOrigin: '',
      dsl: '',
      stage: '',
    });
  });

  it('isolates two bound cards and guards both handles during and after destruction', () => {
    const firstPerf = {
      _generatePipelineOptions: vi.fn(() => ({ pipelineID: 'same' })),
      _markTiming: vi.fn(),
    };
    const secondPerf = {
      _generatePipelineOptions: vi.fn(() => ({ pipelineID: 'same' })),
      _markTiming: vi.fn(),
    };
    const unrelatedPerf = {
      _generatePipelineOptions: vi.fn(),
      _markTiming: vi.fn(),
    };
    const first: HostBTSApp = {
      nativeAppId: 'first',
      lynx: { SystemInfo: { platform: 'first' }, performance: firstPerf },
    };
    const second: HostBTSApp = {
      nativeAppId: 'second',
      lynx: { SystemInfo: { platform: 'second' }, performance: secondPerf },
    };
    hostGlobal.multiApps = { first, second };
    hostGlobal.currentAppId = 'first';
    hostGlobal.lynx = { performance: unrelatedPerf };
    const firstCard = services.bindPage();
    hostGlobal.currentAppId = 'second';
    const secondCard = services.bindPage();
    firstCard.createPipeline();
    secondCard.createPipeline();
    firstCard.markTiming('same', 'first');
    secondCard.markTiming('same', 'second');
    expect(firstCard.getSystemInfo()).toBe(first.lynx!.SystemInfo);
    expect(secondCard.getSystemInfo()).toBe(second.lynx!.SystemInfo);
    expect(firstPerf._markTiming).toHaveBeenCalledExactlyOnceWith(
      'same',
      'first',
    );
    expect(secondPerf._markTiming).toHaveBeenCalledExactlyOnceWith(
      'same',
      'second',
    );
    firstCard.onDestroy(() => {
      expect(firstCard.isDestroyed()).toBe(true);
      expect(firstCard.createPipeline()).toBeUndefined();
      firstCard.markTiming('same', 'destroying');
    });
    first.callDestroyLifetimeFun?.();
    delete hostGlobal.multiApps['first'];
    services.bindPage().createPipeline();
    expect(secondPerf._generatePipelineOptions).toHaveBeenCalledTimes(2);
    firstCard.markTiming('same', 'destroyed');
    expect(firstCard.createPipeline()).toBeUndefined();
    expect(firstCard.getSystemInfo()).toBe(first.lynx!.SystemInfo);
    second.callDestroyLifetimeFun?.();
    delete hostGlobal.multiApps;
    delete hostGlobal.currentAppId;
    expect(() => services.bindPage()).toThrow(/Unable to resolve/);
    expect(secondCard.createPipeline()).toBeUndefined();
    secondCard.markTiming('same', 'detached');
    expect(unrelatedPerf._generatePipelineOptions).not.toHaveBeenCalled();
    expect(unrelatedPerf._markTiming).not.toHaveBeenCalled();
    expect(firstPerf._markTiming).toHaveBeenCalledTimes(1);
    expect(secondPerf._markTiming).toHaveBeenCalledTimes(1);
    hostGlobal.tt = { lynx: { performance: secondPerf } };
    services.bindPage().createPipeline();
    expect(secondPerf._generatePipelineOptions).toHaveBeenCalledTimes(3);
  });

  it('keeps card info readable after host detachment during destruction and never touches performance', () => {
    const info = { platform: 'card' };
    const perf = { _generatePipelineOptions: vi.fn(), _markTiming: vi.fn() };
    const app: HostBTSApp = { lynx: { SystemInfo: info, performance: perf } };
    hostGlobal.tt = app;
    const card = services.bindPage();
    const check = () => {
      expect(card.getSystemInfo()).toBe(info);
      expect(card.createPipeline()).toBeUndefined();
      card.markTiming('late', 'key');
    };
    card.onDestroy(() => {
      delete hostGlobal.tt;
      check();
    });
    app.callDestroyLifetimeFun?.();
    check();
    expect(perf._generatePipelineOptions).not.toHaveBeenCalled();
    expect(perf._markTiming).not.toHaveBeenCalled();
  });

  it('does not borrow unrelated global performance for a resolved card and tolerates missing capabilities', () => {
    const unrelated = vi.fn();
    hostGlobal.lynx = {
      performance: {
        _generatePipelineOptions: unrelated,
        _markTiming: unrelated,
      },
    };
    hostGlobal.tt = { lynx: {} };
    const card = services.bindPage();
    expect(card.createPipeline()).toBeUndefined();
    expect(card.markTiming('id', 'key')).toBeUndefined();
    expect(unrelated).not.toHaveBeenCalled();
  });

  it('ignores malformed host pipelines, missing methods, missing IDs and empty keys', () => {
    hostGlobal.tt = {};
    expect(services.bindPage().createPipeline()).toBeUndefined();
    expect(services.bindPage().markTiming('id', 'key')).toBeUndefined();
    const perf: HostPerformanceObject = {
      _onPipelineStart: vi.fn(),
      _markTiming: vi.fn(),
    };
    hostGlobal.lynx = { performance: perf };
    expect(services.bindPage().createPipeline()).toBeUndefined();
    for (
      const result of [undefined, null, 4, 'id', {}, [], { pipelineID: '' }, {
        pipelineID: 3,
      }]
    ) {
      perf._generatePipelineOptions = () => result;
      expect(services.bindPage().createPipeline()).toBeUndefined();
    }
    expect(perf._onPipelineStart).not.toHaveBeenCalled();
    for (const pipeline of [undefined, {}, '', { pipelineID: '' }]) {
      services.bindPage().markTiming(pipeline, 'key');
    }
    services.bindPage().markTiming('valid', '');
    expect(perf._markTiming).not.toHaveBeenCalled();
    services.bindPage().markTiming('valid', 'always');
    expect(perf._markTiming).toHaveBeenCalledExactlyOnceWith('valid', 'always');
    hostGlobal.lynx.performance = {
      _generatePipelineOptions: () => ({ pipelineID: 'minimal' }),
    };
    expect(services.bindPage().createPipeline({ timingFlag: 'no-binder' }))
      .toEqual({
        pipelineID: 'minimal',
      });
    expect(services.bindPage().markTiming('minimal', 'key')).toBeUndefined();
  });
});

function createHostEventEmitter(
  callLynxSetModule?: (method: string, args: unknown[]) => void,
) {
  const events = new Map<
    string,
    Array<{ listener: (...args: unknown[]) => void; context?: unknown }>
  >();
  const addListenerSpy = vi.fn(
    (
      eventName: string,
      listener: (...args: unknown[]) => void,
      context?: unknown,
    ) => {
      if (eventName === 'keyboardstatuschanged') {
        callLynxSetModule?.('switchKeyBoardDetect', [true]);
      }
      const list = events.get(eventName);
      if (list) {
        list.push({ listener, context });
      } else {
        events.set(eventName, [{ listener, context }]);
      }
    },
  );
  const removeListenerSpy = vi.fn(
    (eventName: string, listener: (...args: unknown[]) => void) => {
      const list = events.get(eventName);
      if (list) {
        const index = list.findIndex((item) => item.listener === listener);
        if (index !== -1) list.splice(index, 1);
      }
      // Mirrors lynx-core EventEmitter's unconditional switchKeyBoardDetect(false).
      if (eventName === 'keyboardstatuschanged') {
        callLynxSetModule?.('switchKeyBoardDetect', [false]);
      }
    },
  );
  const emitter = {
    addListenerSpy,
    removeListenerSpy,
    addListener: addListenerSpy,
    removeListener: removeListenerSpy,
    emit(eventName: string, data: unknown[] = []): void {
      const list = events.get(eventName);
      // Mirrors lynx-core EventEmitter's live Array.forEach + emitter `this`.
      list?.forEach(({ listener, context }) => {
        listener.apply(context ?? emitter, data);
      });
    },
    trigger(eventName: string, params: unknown): void {
      const list = events.get(eventName);
      list?.forEach(({ listener, context }) => {
        listener.call(context ?? emitter, params);
      });
    },
    count(eventName: string): number {
      return events.get(eventName)?.length ?? 0;
    },
  } satisfies HostGlobalEventEmitter & Record<string, unknown>;
  return emitter;
}

describe('BTS global events', () => {
  it('lazily resolves GlobalEventEmitter in page-priority order and fails explicitly when unavailable', () => {
    const appModuleEmitter = createHostEventEmitter();
    const appPropEmitter = createHostEventEmitter();
    const lynxModuleEmitter = createHostEventEmitter();
    const getAppJSModule = vi.fn((name: string) =>
      name === 'GlobalEventEmitter' ? appModuleEmitter : undefined
    );
    const getLynxJSModule = vi.fn((name: string) =>
      name === 'GlobalEventEmitter' ? lynxModuleEmitter : undefined
    );
    const app: HostBTSApp = {
      getJSModule: getAppJSModule,
      GlobalEventEmitter: appPropEmitter,
      lynx: { getJSModule: getLynxJSModule },
    };
    hostGlobal.tt = app;

    const page = bindPage();
    expect(getAppJSModule).not.toHaveBeenCalled();
    expect(getLynxJSModule).not.toHaveBeenCalled();

    const seen: unknown[] = [];
    let receiver: unknown = 'unset';
    const stop1 = page.onGlobalEvent(
      'host:event',
      function(this: void, ...args) {
        receiver = this;
        seen.push(args);
      },
    );
    expect(getAppJSModule).toHaveBeenCalledExactlyOnceWith(
      'GlobalEventEmitter',
    );
    expect(appModuleEmitter.count('host:event')).toBe(1);
    expect(appPropEmitter.count('host:event')).toBe(0);
    expect(lynxModuleEmitter.count('host:event')).toBe(0);

    appModuleEmitter.emit('host:event', ['alpha', 2, { ok: true }]);
    appModuleEmitter.emit('host:event', []);
    appModuleEmitter.trigger('host:event', { triggered: true });
    expect(receiver).toBeUndefined();
    expect(seen).toEqual([
      ['alpha', 2, { ok: true }],
      [],
      [{ triggered: true }],
    ]);
    stop1();
    expect(appModuleEmitter.count('host:event')).toBe(0);

    // Falls back to app.GlobalEventEmitter when app.getJSModule does not return an emitter:
    app.getJSModule = () => ({ invalid: true });
    const propSpy = vi.fn();
    const stop2 = page.onGlobalEvent('prop:event', propSpy);
    appPropEmitter.emit('prop:event', [42]);
    expect(propSpy).toHaveBeenCalledExactlyOnceWith(42);
    stop2();

    // Falls back to page-bound lynx.getJSModule('GlobalEventEmitter') when app properties are absent:
    app.GlobalEventEmitter = null;
    const lynxSpy = vi.fn();
    const stop3 = page.onGlobalEvent('lynx:event', lynxSpy);
    lynxModuleEmitter.emit('lynx:event', ['from-lynx']);
    expect(lynxSpy).toHaveBeenCalledExactlyOnceWith('from-lynx');

    // Replacing the host emitter migrates active channel registrations cleanly:
    const replacedEmitter = createHostEventEmitter();
    app.GlobalEventEmitter = replacedEmitter;
    const replacedSpy = vi.fn();
    page.onGlobalEvent('lynx:event', replacedSpy);
    expect(lynxModuleEmitter.count('lynx:event')).toBe(0);
    expect(replacedEmitter.count('lynx:event')).toBe(1);
    stop3();
    replacedEmitter.emit('lynx:event', ['migrated']);
    expect(lynxSpy).toHaveBeenCalledTimes(1);
    expect(replacedSpy).toHaveBeenCalledExactlyOnceWith('migrated');

    app.GlobalEventEmitter = undefined;
    delete app.lynx!.getJSModule;
    expect(() => page.onGlobalEvent('missing', vi.fn())).toThrow(
      /GlobalEventEmitter/,
    );
  });

  it('shares one host listener per event name, deduplicates callbacks, and avoids premature keyboard detector teardown', () => {
    const setModule = vi.fn();
    const emitter = createHostEventEmitter(setModule);
    hostGlobal.tt = { GlobalEventEmitter: emitter };
    const page = bindPage();

    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = page.onGlobalEvent('keyboardstatuschanged', first);
    const stopDuplicate = page.onGlobalEvent('keyboardstatuschanged', first);
    const stopSecond = page.onGlobalEvent('keyboardstatuschanged', second);

    expect(stopDuplicate).toBe(stopFirst);
    expect(emitter.count('keyboardstatuschanged')).toBe(1);
    expect(setModule.mock.calls).toEqual([['switchKeyBoardDetect', [true]]]);

    emitter.emit('keyboardstatuschanged', ['on', 320, 320]);
    expect(first).toHaveBeenCalledExactlyOnceWith('on', 320, 320);
    expect(second).toHaveBeenCalledExactlyOnceWith('on', 320, 320);

    // Disposing the first subscriber while `second` remains active must NOT call host removeListener:
    stopFirst();
    const stopReadded = page.onGlobalEvent('keyboardstatuschanged', first);
    stopFirst();
    stopDuplicate();
    expect(emitter.count('keyboardstatuschanged')).toBe(1);
    expect(setModule).toHaveBeenCalledTimes(1);

    emitter.emit('keyboardstatuschanged', ['off', 0, 0]);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    stopReadded();
    expect(setModule).toHaveBeenCalledTimes(1);
    stopSecond();
    expect(emitter.count('keyboardstatuschanged')).toBe(0);
    expect(setModule.mock.calls).toEqual([
      ['switchKeyBoardDetect', [true]],
      ['switchKeyBoardDetect', [false]],
    ]);
  });

  it('protects dispatch snapshot mutations and notifies remaining listeners before rethrowing the first error', () => {
    const emitter = createHostEventEmitter();
    hostGlobal.tt = { GlobalEventEmitter: emitter };
    const page = bindPage();

    const order: string[] = [];
    const firstFailure = new Error('first global listener failed');
    let stopMiddle: () => void = vi.fn();
    page.onGlobalEvent('mutate', () => {
      order.push('first');
      stopMiddle();
      page.onGlobalEvent('mutate', () => {
        order.push('late');
      });
      throw firstFailure;
    });
    stopMiddle = page.onGlobalEvent('mutate', () => {
      order.push('middle-removed');
    });
    page.onGlobalEvent('mutate', () => {
      order.push('third');
      throw new Error('second failure');
    });

    expect(() => emitter.emit('mutate', [1])).toThrow(firstFailure);
    expect(order).toEqual(['first', 'third']);

    expect(() => emitter.emit('mutate', [2])).toThrow(firstFailure);
    expect(order).toEqual(['first', 'third', 'first', 'third', 'late']);
  });

  it('keeps LynxGroup pages isolated across async subscriptions and unsubscribes all global events before onDestroy and app.destroy()', async () => {
    const emitterA = createHostEventEmitter();
    const emitterB = createHostEventEmitter();
    const appA: HostBTSApp = {
      nativeAppId: 'card-a',
      getJSModule: (name) =>
        name === 'GlobalEventEmitter' ? emitterA : undefined,
      GlobalEventEmitter: emitterA,
    };
    const appB: HostBTSApp = {
      nativeAppId: 'card-b',
      getJSModule: (name) =>
        name === 'GlobalEventEmitter' ? emitterB : undefined,
      GlobalEventEmitter: emitterB,
    };
    hostGlobal.multiApps = { 'card-a': appA };
    hostGlobal.currentAppId = 'card-a';
    hostGlobal.lynx = {
      getApp: () => hostGlobal.multiApps?.[hostGlobal.currentAppId ?? ''],
      getJSModule: (name) => hostGlobal.lynx?.getApp?.()?.getJSModule?.(name),
    };
    const pageA = bindPage();

    // Load card-b so hostGlobal.currentAppId and hostGlobal.lynx.getApp() now point to card-b:
    hostGlobal.multiApps['card-b'] = appB;
    hostGlobal.currentAppId = 'card-b';
    const pageB = bindPage();

    await Promise.resolve();

    const eventsA: string[] = [];
    const listenerB = vi.fn();
    const stopA = pageA.onGlobalEvent<[string]>('shared:event', (value) => {
      eventsA.push(`first:${value}`);
      if (value === 'destroy-now') {
        appA.callDestroyLifetimeFun?.();
        // Simulate lynx-core app.destroy() clearing GlobalEventEmitter after callDestroyLifetimeFun:
        appA.GlobalEventEmitter = null;
        delete appA.getJSModule;
      }
    });
    pageA.onGlobalEvent<[string]>('shared:event', (value) => {
      eventsA.push(`second:${value}`);
    });
    pageB.onGlobalEvent<[string]>('shared:event', listenerB);

    pageA.onDestroy(() => {
      expect(emitterA.count('shared:event')).toBe(0);
      emitterA.emit('shared:event', ['during-destroy']);
      eventsA.push('onDestroy');
    });

    expect(emitterA.count('shared:event')).toBe(1);
    expect(emitterB.count('shared:event')).toBe(1);

    emitterA.emit('shared:event', ['alive']);
    emitterB.emit('shared:event', ['for-b']);
    expect(eventsA).toEqual(['first:alive', 'second:alive']);
    expect(listenerB).toHaveBeenCalledExactlyOnceWith('for-b');

    const capturedHostDispatch = emitterA.addListenerSpy.mock.calls[0]![1];
    emitterA.emit('shared:event', ['destroy-now']);
    // Second listener on pageA is cancelled immediately when destruction begins:
    expect(eventsA).toEqual([
      'first:alive',
      'second:alive',
      'first:destroy-now',
      'onDestroy',
    ]);
    expect(emitterA.count('shared:event')).toBe(0);
    expect(emitterB.count('shared:event')).toBe(1);

    // Captured host listener and disposer are inert after destruction:
    capturedHostDispatch('stale');
    stopA();
    stopA();
    expect(eventsA).toHaveLength(4);

    // Page B remains active and isolated; broken page without own emitter does not hijack Page B via shared host.lynx:
    emitterB.emit('shared:event', ['still-live']);
    expect(listenerB).toHaveBeenCalledTimes(2);

    const appC: HostBTSApp = { nativeAppId: 'card-c' };
    hostGlobal.multiApps['card-c'] = appC;
    hostGlobal.currentAppId = 'card-c';
    const pageC = bindPage();
    hostGlobal.currentAppId = 'card-b';
    expect(() => pageC.onGlobalEvent('shared:event', vi.fn())).toThrow(
      /GlobalEventEmitter/,
    );
    expect(emitterB.count('shared:event')).toBe(1);
  });
});
