// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initApiEnv } from '../src/api/lynxApi';
import { RunWorkletSource } from '../src/bindings/types';
import { initWorklet } from '../src/workletRuntime';

describe('EventPropagation', () => {
  const consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    globalThis.SystemInfo = {
      lynxSdkVersion: '3.5',
    };
    delete globalThis.lynxWorkletImpl;
    globalThis.lynx = {
      requestAnimationFrame: vi.fn(),
    };
    initApiEnv();
  });

  afterAll(() => {
    consoleMock.mockReset();
  });

  it('stopPropagation should have __EventReturnResult be 1', async () => {
    initWorklet();
    const fn = vi.fn(function(event) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);

      event.stopPropagation();
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });
    expect(ret).toMatchObject({
      returnValue: undefined,
      eventReturnResult: 1,
    });
  });

  it('stopImmediatePropagation should have __EventReturnResult be 2', async () => {
    initWorklet();
    const fn = vi.fn(function(event) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      event.stopImmediatePropagation();
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });
    expect(ret).toMatchObject({
      returnValue: undefined,
      eventReturnResult: 2,
    });
  });

  it('call stopPropagation and stopImmediatePropagation should have __EventReturnResult be 3', async () => {
    initWorklet();
    const fn = vi.fn(function(event) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      event.stopImmediatePropagation();
      event.stopPropagation();
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });
    expect(ret).toMatchObject({
      returnValue: undefined,
      eventReturnResult: 0x1 | 0x2,
    });
  });
});
