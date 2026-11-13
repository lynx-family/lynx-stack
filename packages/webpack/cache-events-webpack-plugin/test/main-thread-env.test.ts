// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import vm from 'node:vm';

import { rspack } from '@rspack/core';
import type { Compilation } from '@rspack/core';
import { describe, expect, it } from '@rstest/core';

import { createLynxCacheEventsSetupListRuntimeModule } from '../src/LynxCacheEventsSetupListRuntimeModule.js';

function createContext(
  isMainThread: boolean,
  globals: Record<string, unknown>,
) {
  const Module = createLynxCacheEventsSetupListRuntimeModule(rspack);
  const module = new Module(list => list, isMainThread);
  Object.assign(module, {
    compilation: { compiler: { webpack: rspack } } as Compilation,
  });
  const context = vm.createContext({ __webpack_require__: {}, ...globals });
  vm.runInContext(module.generate()!, context);
  return context;
}

describe('main-thread environment before async startup', () => {
  it('allows ordinary dependencies to read compatibility globals before ReactLynx loads', () => {
    const systemInfo = { platform: 'Android' };
    const context = createContext(true, { lynx: { SystemInfo: systemInfo } });

    // These free identifiers are read by synchronous dependencies while the
    // async ReactLynx external is still pending.
    expect(vm.runInContext('SystemInfo?.platform', context)).toBe('Android');
    expect(vm.runInContext('NativeModules?.hybridMonitor', context))
      .toBeUndefined();
    expect(context['SystemInfo']).toBe(systemInfo);
    expect(vm.runInContext('"NativeModules" in globalThis', context)).toBe(
      true,
    );
  });

  it('declares NativeModules without installing a main-thread native bridge', () => {
    const context = createContext(true, { lynx: {} });
    expect(vm.runInContext('NativeModules?.hybridMonitor', context))
      .toBeUndefined();
    expect(vm.runInContext('"NativeModules" in globalThis', context)).toBe(
      true,
    );
  });

  it('uses an empty SystemInfo when the host does not provide one', () => {
    const context = createContext(true, { lynx: {} });
    expect(vm.runInContext('SystemInfo?.platform', context)).toBeUndefined();
    expect(context['SystemInfo']).toEqual({});
  });

  it('preserves an existing NativeModules object', () => {
    const nativeModules = { hybridMonitor: {} };
    const context = createContext(true, {
      lynx: {},
      NativeModules: nativeModules,
    });
    expect(context['NativeModules']).toBe(nativeModules);
  });

  it('does not change background globals or its native bridge', () => {
    const systemInfo = { platform: 'background' };
    const nativeModules = { hybridMonitor: {} };
    const context = createContext(false, {
      lynx: { SystemInfo: { platform: 'Android' } },
      SystemInfo: systemInfo,
      NativeModules: nativeModules,
    });
    expect(context['SystemInfo']).toBe(systemInfo);
    expect(context['NativeModules']).toBe(nativeModules);

    const withoutGlobals = createContext(false, { lynx: {} });
    expect(vm.runInContext('"SystemInfo" in globalThis', withoutGlobals)).toBe(
      false,
    );
    expect(vm.runInContext('"NativeModules" in globalThis', withoutGlobals))
      .toBe(false);
  });
});
