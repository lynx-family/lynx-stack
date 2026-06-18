// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, rstest as vi } from '@rstest/core';

import { hydrateWorkletCtx as hydrateWorkletCtxFromBindings } from '../../src/worklet-runtime/bindings';
import { hydrateWorkletCtx, onWorkletCtxUpdate, retainWorkletCtx } from '../../src/worklet-runtime/bindings/observers';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
});

describe('MTFObservers', () => {
  it('should not add a lifecycle ref when execId is missing for an MTF', () => {
    const addRef = vi.fn();
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager = {
      addRef,
    };

    retainWorkletCtx(
      {
        _wkltId: 'ctx1',
      },
    );

    expect(addRef).not.toHaveBeenCalled();
  });

  it('should add a lifecycle ref when execId exists for an MTF', () => {
    const addRef = vi.fn();
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager = {
      addRef,
    };
    const mtf = {
      _wkltId: 'ctx1',
      _execId: 8,
    };

    retainWorkletCtx(mtf);

    expect(addRef).toHaveBeenCalledWith(8, mtf);
  });

  it('should not add lifecycle refs during element updates', () => {
    const addRef = vi.fn();
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager = {
      addRef,
    };

    onWorkletCtxUpdate(
      {
        _wkltId: 'ctx1',
        _execId: 8,
      },
      undefined,
      false,
      'element',
    );

    expect(addRef).not.toHaveBeenCalled();
  });

  it('exports element-free ctx hydration from the bindings entry', () => {
    expect(typeof hydrateWorkletCtxFromBindings).toBe('function');
    expect(hydrateWorkletCtxFromBindings).toBe(hydrateWorkletCtx);
  });

  it('hydrates worklet ctx without replaying delayed worklet events', () => {
    const hydrateCtx = vi.fn();
    const runDelayedWorklet = vi.fn();
    globalThis.lynxWorkletImpl._hydrateCtx = hydrateCtx;
    globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet = runDelayedWorklet;
    const worklet = { _wkltId: 'ctx1' };
    const oldWorklet = { _wkltId: 'ctx1' };

    hydrateWorkletCtx(worklet, oldWorklet);

    expect(hydrateCtx).toHaveBeenCalledWith(worklet, oldWorklet);
    expect(runDelayedWorklet).not.toHaveBeenCalled();
  });

  it('keeps Snapshot ctx update facade compatible with legacy delayed event replay', () => {
    const hydrateCtx = vi.fn();
    const runDelayedWorklet = vi.fn();
    globalThis.lynxWorkletImpl._hydrateCtx = hydrateCtx;
    globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet = runDelayedWorklet;
    const worklet = { _wkltId: 'ctx1' };
    const oldWorklet = { _wkltId: 'ctx1' };
    const element = 'element';

    onWorkletCtxUpdate(worklet, oldWorklet, true, element);

    expect(hydrateCtx).toHaveBeenCalledWith(worklet, oldWorklet);
    expect(runDelayedWorklet).toHaveBeenCalledWith(worklet, element);
  });
});
