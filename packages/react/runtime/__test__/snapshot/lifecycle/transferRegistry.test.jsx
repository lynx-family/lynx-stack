// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import { afterEach, expect, it, vi } from 'vitest';

import { useState } from '../../../src/index';
import { TransferRegistry } from '../../../src/internal';
import { transferDiagnostics } from '../../../src/internal';
import { waitSchedule } from '../utils/nativeMethod';
import { globalEnvManager } from '../utils/envManager';

let destroy;
afterEach(() => {
  destroy?.({ data: {} });
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

it('reuses initialization and tracks independently scheduled state renders', async () => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  const listeners = new Map();
  const core = {
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    removeEventListener: vi.fn(),
  };
  const native = {
    addEventListener: vi.fn((_name, listener) => {
      destroy = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('lynx', {
    ...lynx,
    getCoreContext: () => core,
    getNative: () => native,
  });
  const before = options.__c;
  let update;
  function Counter() {
    transferDiagnostics.recordRender();
    const [, setCount] = useState(0);
    update = setCount;
    return null;
  }
  const first = vi.fn(() => Counter);
  const second = vi.fn(() => () => null);

  TransferRegistry.registerComponent('First', first);
  const transferHook = options.__c;
  expect(transferHook).not.toBe(before);
  expect(core.addEventListener).toHaveBeenCalledTimes(5);
  expect(native.addEventListener).toHaveBeenCalledOnce();

  TransferRegistry.registerComponent('Second', second);
  expect(options.__c).toBe(transferHook);
  expect(core.addEventListener).toHaveBeenCalledTimes(5);
  expect(native.addEventListener).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();

  for (const [componentName, transferId] of [['First', '1'], ['Second', '2']]) {
    listeners.get('__CreateTransfer')({
      data: {
        componentName,
        transferId,
        initialProps: {},
      },
    });
  }
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  expect(transferDiagnostics.debug.records['1'].renders).toBe(1);
  update(value => value + 1);
  await waitSchedule();
  expect(transferDiagnostics.debug.records['1'].renders).toBe(2);
});
