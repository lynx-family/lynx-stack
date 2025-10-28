// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from 'vitest';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { destroyWorklet } from '../../src/worklet/destroy';
import { clearConfigCacheForTesting } from '../../src/worklet/functionality';
import { runOnMainThread } from '../../src/worklet/call/runOnMainThread';
import { globalEnvManager } from '../utils/envManager';
import { initGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { __root } from '../../src/root';
import { root } from '../../src/lynx-api';
import { waitSchedule } from '../utils/nativeMethod';

const App = ({ fn, attr }) => {
  fn?.();
  return (
    <view>
      <text {...attr}>hello</text>
    </view>
  );
};

const MTFQueue = [];

beforeAll(() => {
  vi.stubGlobal(
    'runWorklet',
    vi.fn((worklet, args) => {
      MTFQueue.push({ api: 'runWorklet', worklet, args });
    }),
  );
  vi.stubGlobal('lynxWorkletImpl', {
    _runRunOnMainThreadTask: vi.fn((worklet, args) => {
      MTFQueue.push({ api: '_runRunOnMainThreadTask', worklet, args });
    }),
    _runOnBackgroundDelayImpl: {
      runDelayedBackgroundFunctions: vi.fn(),
    },
    _eomImpl: {
      setShouldFlush: vi.fn((value) => {
        MTFQueue.push({ api: 'setShouldFlush', value });
      }),
    },
    _refImpl: {
      clearFirstScreenWorkletRefMap: vi.fn(),
    },
    _eventDelayImpl: {
      clearDelayedWorklets: vi.fn(),
      runDelayedWorklet: vi.fn(),
    },
  });
  vi.stubGlobal(
    '__FlushElementTree',
    vi.fn(() => {
      MTFQueue.push({ api: '__FlushElementTree' });
    }),
  );
});

beforeEach(() => {
  globalThis.SystemInfo.lynxSdkVersion = '2.14';
  clearConfigCacheForTesting();
  globalEnvManager.resetEnv();
  replaceCommitHook();
});

afterEach(() => {
  destroyWorklet();
  vi.resetAllMocks();
  MTFQueue.length = 0;
});

describe('runOnMainThread', () => {
  it('should trigger event', () => {
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
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
    initGlobalSnapshotPatch();
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
    initGlobalSnapshotPatch();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnMainThread(worklet)(1, ['args']);
    }).toThrowError('runOnMainThread requires Lynx sdk version 2.14.');
  });

  it('should delay until hydration finished while initial rendering', async () => {
    const MTF_during_render = 'MTF_during_render';
    const MTF_after_render = 'MTF_after_render';

    // 1. MTS init render
    {
      __root.__jsx = <App />;
      renderPage();
    }

    // 2. hydration
    {
      globalEnvManager.switchToBackground();
      root.render(<App fn={runOnMainThread(MTF_during_render)} attr={{ 'main-thread:ref': { _wkltId: 'MTRef' } }} />);
      await waitSchedule();
      runOnMainThread(MTF_after_render)();
    }

    // 3. check MTFs are not invoked
    {
      expect(MTFQueue).toMatchInlineSnapshot(`[]`);
      expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`[]`);
      MTFQueue.length = 0;
    }

    // 4. hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // 5. check MTFs are invoked
    {
      expect(MTFQueue).toMatchInlineSnapshot(`
        [
          {
            "api": "runWorklet",
            "args": [
              {
                "elementRefptr": <text
                  has-react-ref={true}
                >
                  <raw-text
                    text="hello"
                  />
                </text>,
              },
            ],
            "worklet": {
              "_unmount": undefined,
              "_wkltId": "MTRef",
            },
          },
          {
            "api": "setShouldFlush",
            "value": false,
          },
          {
            "api": "_runRunOnMainThreadTask",
            "args": [],
            "worklet": "MTF_during_render",
          },
          {
            "api": "_runRunOnMainThreadTask",
            "args": [],
            "worklet": "MTF_after_render",
          },
          {
            "api": "setShouldFlush",
            "value": true,
          },
          {
            "api": "__FlushElementTree",
          },
        ]
      `);
      expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`[]`);
    }
  });

  it('should delay until patch applying finished while updating', async () => {
    const MTF_during_render = 'MTF_during_render';

    // 1. MTS init render
    {
      __root.__jsx = <App />;
      renderPage();
    }

    // 2. hydration
    {
      globalEnvManager.switchToBackground();
      root.render(<App />);
      await waitSchedule();
    }

    // 3. hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // 4. check MTFs are not invoked
    {
      expect(MTFQueue).toMatchInlineSnapshot(`
        [
          {
            "api": "__FlushElementTree",
          },
        ]
      `);
      expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`[]`);
      MTFQueue.length = 0;
    }

    // 5. BTS update
    {
      globalEnvManager.switchToBackground();
      render(
        <App fn={runOnMainThread(MTF_during_render)} attr={{ 'main-thread:ref': { _wkltId: 'MTRef' } }} />,
        __root,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // 6. check MTFs are invoked
    {
      expect(MTFQueue).toMatchInlineSnapshot(`
        [
          {
            "api": "runWorklet",
            "args": [
              {
                "elementRefptr": <text
                  has-react-ref={true}
                >
                  <raw-text
                    text="hello"
                  />
                </text>,
              },
            ],
            "worklet": {
              "_unmount": undefined,
              "_wkltId": "MTRef",
            },
          },
          {
            "api": "setShouldFlush",
            "value": false,
          },
          {
            "api": "_runRunOnMainThreadTask",
            "args": [],
            "worklet": "MTF_during_render",
          },
          {
            "api": "setShouldFlush",
            "value": true,
          },
          {
            "api": "__FlushElementTree",
          },
        ]
      `);
      expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`[]`);
    }
  });
});
