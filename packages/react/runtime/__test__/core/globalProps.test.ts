// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext } from 'preact';
import { createElement } from 'preact/compat';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGlobalProps, isGlobalPropsEventMode, updateGlobalProps } from '../../src/core/globalProps.js';
import type { useLynxGlobalEventListener } from '../../src/core/hooks/useLynxGlobalEventListener.js';
import { LynxTestEventEmitter } from '../test-utils/lynx-event-emitter.js';

describe('core/globalProps', () => {
  let originalGlobalProps: typeof lynx.__globalProps;
  let originalEmitter: typeof lynxCoreInject.tt.GlobalEventEmitter;
  let emitter: LynxTestEventEmitter;

  beforeEach(() => {
    originalGlobalProps = lynx.__globalProps;
    originalEmitter = lynxCoreInject.tt.GlobalEventEmitter;
    emitter = new LynxTestEventEmitter();
    lynx.__globalProps = {};
    lynxCoreInject.tt.GlobalEventEmitter = emitter as typeof lynxCoreInject.tt.GlobalEventEmitter;
  });

  afterEach(() => {
    lynx.__globalProps = originalGlobalProps;
    lynxCoreInject.tt.GlobalEventEmitter = originalEmitter;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    vi.stubGlobal('__LEPUS__', false);
    vi.stubGlobal('__DEV__', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const useListener = vi.fn() as unknown as typeof useLynxGlobalEventListener;
    lynx.__globalProps = { theme: 'dark' };

    const globalProps = createGlobalProps<{ theme: string }>(createDeps(useListener));
    const callback = vi.fn();

    expect((globalProps.Provider() as any)({ children: 'child' })).toBe('child');
    expect((globalProps.Consumer() as any)({ children: (data: { theme: string }) => data.theme })).toBe('dark');
    expect(globalProps.use()()).toEqual({ theme: 'dark' });
    globalProps.useChanged()(callback);

    expect(warn).toHaveBeenCalledTimes(3);
    expect(useListener).toHaveBeenCalledWith('onGlobalPropsChanged', callback);
  });

  it('keeps the fallback shell quiet and listener-free on lepus', () => {
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    vi.stubGlobal('__LEPUS__', true);
    vi.stubGlobal('__DEV__', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const useListener = vi.fn() as unknown as typeof useLynxGlobalEventListener;

    const globalProps = createGlobalProps(createDeps(useListener));
    globalProps.use()();
    globalProps.useChanged()(vi.fn());

    expect(warn).not.toHaveBeenCalled();
    expect(useListener).not.toHaveBeenCalled();
  });

  it('creates the event-mode shell through the shared InitData factory', () => {
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'event');
    const useListener = vi.fn() as unknown as typeof useLynxGlobalEventListener;

    const globalProps = createGlobalProps(createDeps(useListener));

    expect(isGlobalPropsEventMode()).toBe(true);
    expect(globalProps.Provider()).toBeTypeOf('function');
    expect(globalProps.Consumer()).toBeTypeOf('function');
    expect(globalProps.use()).toBeTypeOf('function');
    expect(globalProps.useChanged()).toBeTypeOf('function');
  });

  it('treats missing mode as reactive mode', () => {
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', undefined);

    expect(isGlobalPropsEventMode()).toBe(false);
  });

  it('mutates globalProps in reactive mode, emits current data, and queues force render', async () => {
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    const listener = vi.fn();
    const forceRerender = vi.fn();
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
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'reactive');
    lynx.__globalProps = { theme: 'dark' };

    expect(() => updateGlobalProps({ theme: 'light' })).not.toThrow();
    await Promise.resolve();
    expect(lynx.__globalProps).toEqual({ theme: 'light' });
  });

  it('COW merges globalProps in event mode and skips force render', async () => {
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', 'event');
    const listener = vi.fn();
    const forceRerender = vi.fn();
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
