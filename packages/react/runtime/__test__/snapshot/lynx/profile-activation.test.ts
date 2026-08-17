// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

interface RuntimeGlobals {
  __DEV__: boolean;
  __PROFILE__: boolean;
  __PROFILE_COMPONENT_HOOKS__: boolean | undefined;
  __BACKGROUND__: boolean;
  __MAIN_THREAD__: boolean;
  __ALOG__: boolean;
  __ALOG_ELEMENT_API__: boolean;
}

interface PreactOptions {
  document?: unknown;
  requestAnimationFrame?: unknown;
}

const runtimeGlobals = globalThis as typeof globalThis & RuntimeGlobals;
const originalNodeEnv = process.env['NODE_ENV'];
const originalDevFlag = runtimeGlobals.__DEV__;
const originalProfileFlag = runtimeGlobals.__PROFILE__;
const originalProfileComponentHooksFlag = runtimeGlobals.__PROFILE_COMPONENT_HOOKS__;
const originalBackgroundFlag = runtimeGlobals.__BACKGROUND__;
const originalMainThreadFlag = runtimeGlobals.__MAIN_THREAD__;
const originalAlogFlag = runtimeGlobals.__ALOG__;
const originalAlogElementApiFlag = runtimeGlobals.__ALOG_ELEMENT_API__;
const originalIsProfileRecording = globalThis.lynx.performance.isProfileRecording;

async function importBackgroundRuntime(
  compileTimeProfile: boolean,
  isProfileRecording: boolean,
  includeProfileComponentHooks = true,
) {
  vi.resetModules();
  process.env['NODE_ENV'] = 'production';
  runtimeGlobals.__DEV__ = false;
  runtimeGlobals.__PROFILE__ = compileTimeProfile;
  runtimeGlobals.__PROFILE_COMPONENT_HOOKS__ = includeProfileComponentHooks;
  runtimeGlobals.__BACKGROUND__ = true;
  runtimeGlobals.__MAIN_THREAD__ = false;
  runtimeGlobals.__ALOG__ = false;
  runtimeGlobals.__ALOG_ELEMENT_API__ = false;
  globalThis.lynx.performance.isProfileRecording = vi.fn(
    () => isProfileRecording,
  );

  const options: PreactOptions = {};
  const setupBackgroundDocument = vi.fn();
  const initProfileHook = vi.fn();
  const replaceCommitHook = vi.fn();
  const initTimingAPI = vi.fn();

  vi.doMock('preact', () => ({ options }));
  vi.doMock('../../../src/core/hooks/react.js', () => ({}));
  vi.doMock('../../../src/document.js', () => ({
    document: {},
    setupBackgroundDocument,
  }));
  vi.doMock('../../../src/shared/component-stack.js', () => ({
    setupComponentStack: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/alog/elementPAPICall.js', () => ({
    initElementPAPICallAlog: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/alog/index.js', () => ({
    initAlog: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/debug/profileHooks.js', () => ({
    initProfileHook,
  }));
  vi.doMock('../../../src/snapshot/debug/vnodeSource.js', () => ({
    setupVNodeSourceHook: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lifecycle/patch/commit.js', () => ({
    replaceCommitHook,
  }));
  vi.doMock('../../../src/snapshot/lifecycle/patch/error.js', () => ({
    addCtxNotFoundEventListener: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lifecycle/patch/updateMainThread.js', () => ({
    injectUpdateMainThread: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/calledByNative.js', () => ({
    injectCalledByNative: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/env.js', () => ({
    setupLynxEnv: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/injectLepusMethods.js', () => ({
    injectLepusMethods: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/performance.js', () => ({
    initTimingAPI,
  }));
  vi.doMock('../../../src/snapshot/lynx/prepareLazyBundleMTS.js', () => ({
    injectPrepareLazyBundleMTS: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/runWithForce.js', () => ({
    runWithForce: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/lynx/tt.js', () => ({
    injectTt: vi.fn(),
  }));
  vi.doMock('../../../src/snapshot/worklet/ref/updateInitValue.js', () => ({
    injectUpdateMTRefInitValue: vi.fn(),
  }));
  vi.doMock('../../../src/utils.js', () => ({
    lynxQueueMicrotask: vi.fn(),
  }));

  await import('../../../src/lynx.js');

  return {
    initProfileHook,
    initTimingAPI,
    options,
    replaceCommitHook,
    setupBackgroundDocument,
  };
}

afterEach(() => {
  process.env['NODE_ENV'] = originalNodeEnv;
  runtimeGlobals.__DEV__ = originalDevFlag;
  runtimeGlobals.__PROFILE__ = originalProfileFlag;
  runtimeGlobals.__PROFILE_COMPONENT_HOOKS__ = originalProfileComponentHooksFlag;
  runtimeGlobals.__BACKGROUND__ = originalBackgroundFlag;
  runtimeGlobals.__MAIN_THREAD__ = originalMainThreadFlag;
  runtimeGlobals.__ALOG__ = originalAlogFlag;
  runtimeGlobals.__ALOG_ELEMENT_API__ = originalAlogElementApiFlag;
  globalThis.lynx.performance.isProfileRecording = originalIsProfileRecording;
  vi.resetModules();
  vi.doUnmock('preact');
  vi.doUnmock('../../../src/core/hooks/react.js');
  vi.doUnmock('../../../src/document.js');
  vi.doUnmock('../../../src/shared/component-stack.js');
  vi.doUnmock('../../../src/snapshot/alog/elementPAPICall.js');
  vi.doUnmock('../../../src/snapshot/alog/index.js');
  vi.doUnmock('../../../src/snapshot/debug/profileHooks.js');
  vi.doUnmock('../../../src/snapshot/debug/vnodeSource.js');
  vi.doUnmock('../../../src/snapshot/lifecycle/patch/commit.js');
  vi.doUnmock('../../../src/snapshot/lifecycle/patch/error.js');
  vi.doUnmock('../../../src/snapshot/lifecycle/patch/updateMainThread.js');
  vi.doUnmock('../../../src/snapshot/lynx/calledByNative.js');
  vi.doUnmock('../../../src/snapshot/lynx/env.js');
  vi.doUnmock('../../../src/snapshot/lynx/injectLepusMethods.js');
  vi.doUnmock('../../../src/snapshot/lynx/performance.js');
  vi.doUnmock('../../../src/snapshot/lynx/prepareLazyBundleMTS.js');
  vi.doUnmock('../../../src/snapshot/lynx/runWithForce.js');
  vi.doUnmock('../../../src/snapshot/lynx/tt.js');
  vi.doUnmock('../../../src/snapshot/worklet/ref/updateInitValue.js');
  vi.doUnmock('../../../src/utils.js');
});

describe('snapshot runtime profile activation', () => {
  it.each([
    ['default Web', false, false, false, 0],
    ['compile-time Web profiling', true, false, true, 1],
    ['native host recording', false, true, true, 1],
  ])(
    'installs background profile hooks for %s',
    async (
      _activation,
      compileTimeProfile,
      isProfileRecording,
      includeProfileComponentHooks,
      expectedProfileHookCalls,
    ) => {
      const {
        initProfileHook,
        initTimingAPI,
        options,
        replaceCommitHook,
        setupBackgroundDocument,
      } = await importBackgroundRuntime(
        compileTimeProfile,
        isProfileRecording,
        includeProfileComponentHooks,
      );

      expect(setupBackgroundDocument).toHaveBeenCalledTimes(1);
      expect(replaceCommitHook).toHaveBeenCalledTimes(1);
      expect(initTimingAPI).toHaveBeenCalledTimes(1);
      expect(initProfileHook).toHaveBeenCalledTimes(
        expectedProfileHookCalls,
      );
      expect(options.document).toEqual({});
      expect(typeof options.requestAnimationFrame).toBe('function');
    },
  );
});
