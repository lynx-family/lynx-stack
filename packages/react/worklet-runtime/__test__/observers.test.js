// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onWorkletCtxUpdate } from '../src/bindings/observers';
import { initWorklet } from '../src/workletRuntime';

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

    onWorkletCtxUpdate(
      {
        _wkltId: 'ctx1',
      },
      undefined,
      false,
      'element',
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

    onWorkletCtxUpdate(mtf, undefined, false, 'element');

    expect(addRef).toHaveBeenCalledWith(8, mtf);
  });
});
