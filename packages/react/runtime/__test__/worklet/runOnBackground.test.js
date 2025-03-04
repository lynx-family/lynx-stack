// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { destroyWorklet } from '../../src/worklet/jsImpl';
import { runOnBackground } from '../../src/worklet/runOnBackground';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  destroyWorklet();
});

describe('runOnBackground', () => {
  it('should trigger event', () => {
    globalEnvManager.switchToMainThread();
    const jsFn = {
      _jsFnId: 233,
      _execId: 244,
    };
    runOnBackground(jsFn)(1, ['args']);
    expect(lynx.getJSContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": "{"obj":{"_jsFnId":233,"_execId":244},"params":[1,["args"]]}",
            "type": "Lynx.Worklet.runOnBackground",
          },
        ],
      ]
    `);
  });

  it('should throw when on the main thread', () => {
    globalEnvManager.switchToBackground();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnBackground(worklet)(1, ['args']);
    }).toThrowError('runOnBackground can not be used on the main thread.');
  });

  it('should throw when native capabilities not fulfilled', () => {
    globalEnvManager.switchToMainThread();
    SystemInfo.lynxSdkVersion = '2.15';
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnBackground(worklet)(1, ['args']);
    }).toThrowError('runOnBackground requires Lynx sdk version 2.16.');
  });

  it('should throw when _error exists', () => {
    globalEnvManager.switchToMainThread();
    const jsFn = {
      _jsFnId: 233,
      _error: 'error occurred',
    };
    expect(() => {
      runOnBackground(jsFn)(1, ['args']);
    }).toThrowError('error occurred');
  });
});
