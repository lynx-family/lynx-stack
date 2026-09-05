// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext } from 'preact';
import { createElement } from 'preact/compat';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { createGlobalProps, isGlobalPropsEventMode, updateGlobalProps } from '../../src/core/globalProps.js';
import type { useLynxGlobalEventListener } from '../../src/core/hooks/useLynxGlobalEventListener.js';
import { LynxTestEventEmitter } from '../test-utils/lynx-event-emitter.js';

describe('core/globalProps', () => {
  let originalGlobalProps: typeof lynx.__globalProps;
  let originalEmitter: LynxApp['GlobalEventEmitter'];
  let emitter: LynxTestEventEmitter;

  beforeEach(() => {
    originalGlobalProps = lynx.__globalProps;
    originalEmitter = lynx.getApp().GlobalEventEmitter;
    emitter = new LynxTestEventEmitter();
    lynx.__globalProps = {};
    lynx.getApp().GlobalEventEmitter = emitter as LynxApp['GlobalEventEmitter'];
  });

  afterEach(() => {
    lynx.__globalProps = originalGlobalProps;
    lynx.getApp().GlobalEventEmitter = originalEmitter;
    rs.unstubAllGlobals();
    rs.restoreAllMocks();
  });

  function createDeps(useListener: typeof useLynxGlobalEventListener) {
    return {
      createContext,
      useState,
      createElement,
      useLynxGlobalEventListener: useListener,
    };
  }

  it('creates the reactive fallback shell with warning and changed listener support', () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    rs.stubGlobal('__LEPUS__', false);
    rs.stubGlobal('__DEV__', true);
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => {});
    const useListener = rs.fn() as unknown as typeof useLynxGlobalEventListener;
    lynx.__globalProps = { theme: 'dark' };

    const globalProps = createGlobalProps<{ theme: string }>(createDeps(useListener));
    const callback = rs.fn();

    expect((globalProps.Provider() as any)({ children: 'child' })).toBe('child');
    expect((globalProps.Consumer() as any)({ children: (data: { theme: string }) => data.theme })).toBe('dark');
    expect(globalProps.use()()).toEqual({ theme: 'dark' });
    globalProps.useChanged()(callback);

    expect(warn).toHaveBeenCalledTimes(3);
    expect(useListener).toHaveBeenCalledWith('onGlobalPropsChanged', callback);
  });

  it('keeps the fallback shell quiet and listener-free on lepus', () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    rs.stubGlobal('__LEPUS__', true);
    rs.stubGlobal('__DEV__', true);
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => {});
    const useListener = rs.fn() as unknown as typeof useLynxGlobalEventListener;

    const globalProps = createGlobalProps(createDeps(useListener));
    globalProps.use()();
    globalProps.useChanged()(rs.fn());

    expect(warn).not.toHaveBeenCalled();
    expect(useListener).not.toHaveBeenCalled();
  });

  it('creates the event-mode shell through the shared InitData factory', () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'event');
    const useListener = rs.fn() as unknown as typeof useLynxGlobalEventListener;

    const globalProps = createGlobalProps(createDeps(useListener));

    expect(isGlobalPropsEventMode()).toBe(true);
    expect(globalProps.Provider()).toBeTypeOf('function');
    expect(globalProps.Consumer()).toBeTypeOf('function');
    expect(globalProps.use()).toBeTypeOf('function');
    expect(globalProps.useChanged()).toBeTypeOf('function');
  });

  it('treats missing mode as reactive mode', () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', undefined);

    expect(isGlobalPropsEventMode()).toBe(false);
  });

  it('mutates globalProps in reactive mode, emits current data, and queues force render', async () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    const listener = rs.fn();
    const forceRerender = rs.fn();
    const previousGlobalProps = { theme: 'dark', stable: true };
    lynx.__globalProps = previousGlobalProps;
    emitter.addListener('onGlobalPropsChanged', listener);

    updateGlobalProps({ theme: 'light', next: 1 }, { forceRerender });

    expect(lynx.__globalProps).toBe(previousGlobalProps);
    expect(lynx.__globalProps).toEqual({ theme: 'light', stable: true, next: 1 });
    expect(listener).toHaveBeenCalledWith(lynx.__globalProps);
    expect(forceRerender).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(forceRerender).toHaveBeenCalledTimes(1);
  });

  it('allows reactive updates without a force callback', async () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    lynx.__globalProps = { theme: 'dark' };

    expect(() => updateGlobalProps({ theme: 'light' })).not.toThrow();
    await Promise.resolve();
    expect(lynx.__globalProps).toEqual({ theme: 'light' });
  });

  it('COW merges globalProps in event mode and skips force render', async () => {
    rs.stubGlobal('__GLOBAL_PROPS_MODE__', 'event');
    const listener = rs.fn();
    const forceRerender = rs.fn();
    const previousGlobalProps = { theme: 'dark', stable: true };
    lynx.__globalProps = previousGlobalProps;
    emitter.addListener('onGlobalPropsChanged', listener);

    updateGlobalProps({ theme: 'light', next: 1 }, { forceRerender });
    await Promise.resolve();

    expect(lynx.__globalProps).not.toBe(previousGlobalProps);
    expect(lynx.__globalProps).toEqual({ theme: 'light', stable: true, next: 1 });
    expect(listener).toHaveBeenCalledWith(lynx.__globalProps);
    expect(forceRerender).not.toHaveBeenCalled();
  });
});
