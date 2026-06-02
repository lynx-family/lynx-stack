// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalCommitContext } from '../../../src/core/commit-context';
import { installComponentCompat } from '../../../src/core/component';
import { markTimingLegacy, PerfSpecificKey } from '../../../src/core/performance';
import { NEXT_STATE } from '../../../src/shared/render-constants';

describe('installComponentCompat', () => {
  let originalJS: boolean;
  let originalDisableWarning: boolean | undefined;
  let originalTT: any;
  let originalReportError: typeof lynx.reportError;
  let originalGetElementById: typeof lynx.getElementById;
  let originalCreateSelectorQuery: typeof lynx.createSelectorQuery;
  let originalMarkTiming: typeof lynx.getNativeApp extends () => infer NativeApp
    ? NativeApp extends { markTiming: infer MarkTiming } ? MarkTiming : never
    : never;
  let originalSetState: unknown;
  let originalStoredSetState: unknown;

  beforeEach(() => {
    originalJS = __JS__;
    originalDisableWarning = globalThis.__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__;
    originalTT = lynxCoreInject.tt;
    originalReportError = lynx.reportError;
    originalGetElementById = lynx.getElementById;
    originalCreateSelectorQuery = lynx.createSelectorQuery;
    originalMarkTiming = lynx.getNativeApp().markTiming;
    originalSetState = Component.prototype.setState;
    originalStoredSetState = (Component.prototype as any).__reactLynxOriginalSetState;

    globalThis.__JS__ = true;
    globalThis.__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__ = false;
    lynx.reportError = vi.fn();
    lynx.getNativeApp().markTiming = vi.fn();
    globalCommitContext.flushOptions = {};
  });

  afterEach(() => {
    globalThis.__JS__ = originalJS;
    globalThis.__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__ = originalDisableWarning;
    lynxCoreInject.tt = originalTT;
    lynx.reportError = originalReportError;
    lynx.getElementById = originalGetElementById;
    lynx.createSelectorQuery = originalCreateSelectorQuery;
    lynx.getNativeApp().markTiming = originalMarkTiming;
    Component.prototype.setState = originalSetState as typeof Component.prototype.setState;
    if (originalStoredSetState) {
      (Component.prototype as any).__reactLynxOriginalSetState = originalStoredSetState;
    } else {
      delete (Component.prototype as any).__reactLynxOriginalSetState;
    }
    globalCommitContext.flushOptions = {};
  });

  it('does not install on non-js threads', () => {
    const setState = Component.prototype.setState;

    globalThis.__JS__ = false;

    installComponentCompat();

    expect(Component.prototype.setState).toBe(setState);
  });

  it('installs legacy component APIs from Lynx runtime globals', () => {
    const uiModule = {};
    const nativeApp = {
      nativeModuleProxy: {
        LynxUIMethodModule: uiModule,
      },
    };
    const getNodeRef = vi.fn(function(this: unknown, selector: string, single?: boolean) {
      return { receiver: this, selector, single };
    });
    const getNodeRefFromRoot = vi.fn(function(this: unknown, selector: string) {
      return { receiver: this, selector };
    });
    const GlobalEventEmitter = { addListener: vi.fn() };
    const module = {};
    const selectorQuery = {};
    const element = {};

    lynxCoreInject.tt = {
      _nativeApp: nativeApp,
      _reactLynx: {
        ReactComponent: {
          prototype: {
            getNodeRef,
            getNodeRefFromRoot,
          },
        },
      },
      GlobalEventEmitter,
      registerModule: vi.fn(),
      getJSModule: vi.fn(() => GlobalEventEmitter),
    };
    lynx.getElementById = vi.fn(() => element);
    lynx.createSelectorQuery = vi.fn(() => selectorQuery);

    installComponentCompat();

    const component = new Component({}, {}) as any;

    expect(component._reactAppInstance).toBe(lynxCoreInject.tt);
    expect(component.getNodeRef('#target', true)).toEqual({
      receiver: {
        _type: '',
        _nativeApp: nativeApp,
        _uiModule: uiModule,
        _reactAppInstance: lynxCoreInject.tt,
      },
      selector: '#target',
      single: true,
    });
    expect(component.getNodeRefFromRoot('#root')).toEqual({
      receiver: {
        _type: '',
        _nativeApp: nativeApp,
        _uiModule: uiModule,
        _reactAppInstance: lynxCoreInject.tt,
      },
      selector: '#root',
    });

    component.registerModule('module', module);
    expect(lynxCoreInject.tt.registerModule).toHaveBeenCalledWith('module', module);
    expect(component.getJSModule('GlobalEventEmitter')).toBe(GlobalEventEmitter);

    const listener = vi.fn();
    component.addGlobalEventListener('event', listener, component);
    expect(GlobalEventEmitter.addListener).toHaveBeenCalledWith('event', listener, component);

    expect(component.getElementById('id')).toBe(element);
    expect(component.GlobalEventEmitter).toBe(GlobalEventEmitter);
    expect(component.createSelectorQuery()).toBe(selectorQuery);
    expect(lynx.reportError).toHaveBeenCalledTimes(4);

    globalThis.__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__ = true;
    component.createSelectorQuery();
    expect(lynx.reportError).toHaveBeenCalledTimes(4);
  });

  it('wraps setState once and records legacy timing flags', () => {
    installComponentCompat();
    const wrappedSetState = Component.prototype.setState;
    installComponentCompat();

    expect((Component.prototype as any).__reactLynxOriginalSetState).toBe(originalSetState);
    expect(Component.prototype.setState).not.toBe(originalSetState);
    expect(Component.prototype.setState).not.toBe(wrappedSetState);

    const componentWithoutTiming = new Component({}, {}) as any;
    componentWithoutTiming.state = {};
    componentWithoutTiming.setState({ count: 1 });

    expect(globalCommitContext.flushOptions.__lynx_timing_flag).toBeUndefined();

    const componentWithTiming = new Component({}, {}) as any;
    componentWithTiming.state = {};
    componentWithTiming[NEXT_STATE] = {
      [PerfSpecificKey]: 'timing-flag',
    };

    componentWithTiming.setState({ count: 2 });

    expect(globalCommitContext.flushOptions.__lynx_timing_flag).toBe('timing-flag');
    expect(lynx.getNativeApp().markTiming).toHaveBeenCalledWith(
      'timing-flag',
      'updateSetStateTrigger',
    );
    expect(componentWithTiming[NEXT_STATE][PerfSpecificKey]).toBe('');
  });

  it('ignores legacy diff timing before a setState timing trigger', () => {
    markTimingLegacy('updateDiffVdomStart');
    (lynx.getNativeApp().markTiming as ReturnType<typeof vi.fn>).mockClear();

    markTimingLegacy('updateDiffVdomStart');

    expect(lynx.getNativeApp().markTiming).not.toHaveBeenCalled();
  });
});
