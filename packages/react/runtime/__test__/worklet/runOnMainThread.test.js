// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { destroyWorklet } from '../../src/worklet/destroy';
import { clearConfigCacheForTesting } from '../../src/worklet/functionality';
import { runOnMainThread } from '../../src/worklet/runOnMainThread';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  globalThis.SystemInfo.lynxSdkVersion = '2.14';
  clearConfigCacheForTesting();
});

afterEach(() => {
  destroyWorklet();
});

describe('runOnMainThread', () => {
  it('should trigger event', () => {
    globalEnvManager.switchToBackground();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    runOnMainThread(worklet)(1, ['args']);
    expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": "{"worklet":{"_wkltId":"835d:450ef:2"},"params":[1,["args"]],"resolveId":1}",
            "type": "Lynx.Worklet.runWorkletCtx",
          },
        ],
      ]
    `);
  });

  it('should get return value', async () => {
    globalEnvManager.switchToBackground();
    const promise = runOnMainThread('someWorklet')('hello');

    globalEnvManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({
        resolveId: 1,
        returnValue: 'world',
      }),
    });

    await expect(promise).resolves.toBe('world');
  });

  it('should throw when on the main thread', () => {
    globalEnvManager.switchToMainThread();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnMainThread(worklet)(1, ['args']);
    }).toThrowError('runOnMainThread can only be used on the background thread.');
  });

  it('should not trigger event when native capabilities not fulfilled', () => {
    globalThis.SystemInfo.lynxSdkVersion = '2.13';
    globalEnvManager.switchToBackground();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnMainThread(worklet)(1, ['args']);
    }).toThrowError('runOnMainThread requires Lynx sdk version 2.14.');
  });
});
