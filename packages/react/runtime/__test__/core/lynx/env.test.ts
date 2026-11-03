// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupSharedLynxEnv } from '../../../src/core/lynx/env.js';

type GlobalWithEnv = typeof globalThis & {
  __LEPUS__?: boolean;
  __OnLifecycleEvent?: ReturnType<typeof vi.fn>;
  NativeModules?: unknown;
  SystemInfo?: unknown;
  processData?: (data: unknown, processorName?: string) => unknown;
};

type LynxWithSystemInfo = typeof globalThis.lynx & {
  SystemInfo?: unknown;
};

describe('setupSharedLynxEnv', () => {
  const g = globalThis as GlobalWithEnv;
  let originalLepus: boolean | undefined;
  let originalOnLifecycleEvent: typeof g.__OnLifecycleEvent;
  let originalProcessData: typeof g.processData;
  let originalNativeModules: typeof g.NativeModules;
  let originalSystemInfo: typeof g.SystemInfo;
  let originalLynxSystemInfo: LynxWithSystemInfo['SystemInfo'];
  let originalAppDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLepus = g.__LEPUS__;
    originalOnLifecycleEvent = g.__OnLifecycleEvent;
    originalProcessData = g.processData;
    originalNativeModules = g.NativeModules;
    originalSystemInfo = g.SystemInfo;
    originalLynxSystemInfo = (globalThis.lynx as LynxWithSystemInfo).SystemInfo;
    originalAppDescriptor = Object.getOwnPropertyDescriptor(globalThis.lynx.getApp(), '_params');
  });

  afterEach(() => {
    g.__LEPUS__ = originalLepus;
    g.__OnLifecycleEvent = originalOnLifecycleEvent;
    if (originalProcessData === undefined) {
      delete g.processData;
    } else {
      g.processData = originalProcessData;
    }
    if (originalNativeModules === undefined) {
      delete g.NativeModules;
    } else {
      g.NativeModules = originalNativeModules;
    }
    if (originalSystemInfo === undefined) {
      delete g.SystemInfo;
    } else {
      g.SystemInfo = originalSystemInfo;
    }
    if (originalLynxSystemInfo === undefined) {
      delete (globalThis.lynx as LynxWithSystemInfo).SystemInfo;
    } else {
      (globalThis.lynx as LynxWithSystemInfo).SystemInfo = originalLynxSystemInfo;
    }
    if (originalAppDescriptor) {
      Object.defineProperty(globalThis.lynx.getApp(), '_params', originalAppDescriptor);
    } else {
      delete (globalThis.lynx.getApp() as { _params?: unknown })._params;
    }
  });

  it('initializes background __initData across valid, partial, missing, and throwing params', () => {
    g.__LEPUS__ = false;
    globalThis.lynx.getApp()._params = {
      initData: { a: 1, b: 2 },
      updateData: { b: 3, c: 4 },
    };
    setupSharedLynxEnv();
    expect(globalThis.lynx.__initData).toEqual({ a: 1, b: 3, c: 4 });
    expect(() => globalThis.lynx.registerDataProcessors()).not.toThrow();

    Object.defineProperty(globalThis.lynx.getApp(), '_params', {
      configurable: true,
      value: { initData: undefined, updateData: undefined },
    });
    setupSharedLynxEnv();
    expect(globalThis.lynx.__initData).toEqual({});

    Object.defineProperty(globalThis.lynx.getApp(), '_params', {
      configurable: true,
      value: undefined,
    });
    setupSharedLynxEnv();
    expect(globalThis.lynx.__initData).toEqual({});

    Object.defineProperty(globalThis.lynx.getApp(), '_params', {
      configurable: true,
      get() {
        throw new Error('params unavailable');
      },
    });
    setupSharedLynxEnv();
    expect(globalThis.lynx.__initData).toEqual({});
  });

  it('initializes main-thread SystemInfo, NativeModules placeholder, global events, and data processors', () => {
    vi.stubGlobal('__EXTRACT_STR__', false);
    try {
      g.__LEPUS__ = true;
      g.__OnLifecycleEvent = vi.fn();
      delete g.NativeModules;
      const systemInfo = { lynxSdkVersion: '3.8' };
      (globalThis.lynx as LynxWithSystemInfo).SystemInfo = systemInfo;

      setupSharedLynxEnv();

      expect(globalThis.lynx.__initData).toEqual({});
      expect(g.SystemInfo).toBe(systemInfo);
      expect('NativeModules' in g).toBe(true);
      expect(g.NativeModules).toBeUndefined();

      globalThis.lynx.triggerGlobalEventFromLepus?.('ready', { count: 1 });
      expect(g.__OnLifecycleEvent).toHaveBeenCalledWith(['globalEventFromLepus', ['ready', { count: 1 }]]);
      expect(g.processData?.({ x: 1 })).toEqual({ x: 1 });

      globalThis.lynx.registerDataProcessors?.({
        defaultDataProcessor: (data: { x: number }) => ({ doubled: data.x * 2 }),
        dataProcessors: {
          named: (data: { x: number }) => ({ named: data.x }),
        },
      });
      expect(g.processData?.({ x: 2 }, 'named')).toEqual({ named: 2 });
      expect(g.processData?.({ x: 3 })).toEqual({ doubled: 6 });

      const existingNativeModules = { bridge: {} };
      g.NativeModules = existingNativeModules;
      delete (globalThis.lynx as LynxWithSystemInfo).SystemInfo;

      setupSharedLynxEnv();

      expect(g.SystemInfo).toEqual({});
      expect(g.NativeModules).toBe(existingNativeModules);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
