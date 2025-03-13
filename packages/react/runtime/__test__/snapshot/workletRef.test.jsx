/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCompBG1, createCompBGList, createCompBGSpread } from './workletRefBG';
import { createCompMT1, createCompMTList, createCompMTSpread } from './workletRefMT';
import { injectUpdatePatch, replaceCommitHook } from '../../src/lifecycle/patch/patchUpdate';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdatePatch();
  replaceCommitHook();

  globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = true;
  globalThis.lynxWorkletImpl = {
    _refImpl: {
      updateWorkletRef: vi.fn(),
      updateWorkletRefInitValueChanges: vi.fn(),
    },
    _eventDelayImpl: {
      clearDelayedWorklets: vi.fn(),
    },
  };
  globalThis.runWorklet = vi.fn();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('WorkletRef', () => {
  it('insert & remove', async function() {
    // main thread render
    {
      __root.__jsx = [createCompMT1('null'), createCompMT1('null')];
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
          </view>
          <view>
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render([createCompBG1('null'), createCompBG1('null')], __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // insert
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render([createCompBG1('ref1'), createCompBG1('mts')], __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
          </view>
          <view>
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 1,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 1,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              {
                "elementRefptr": <view
                  has-react-ref={true}
                />,
              },
            ],
          ],
        ]
      `);
    }

    // remove
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      globalThis.runWorklet.mockClear();
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render([createCompBG1('null'), createCompBG1('null')], __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 1,
            },
            null,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 1,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              null,
            ],
          ],
        ]
      `);
    }
  });

  it('update', async function() {
    const cleanup = vi.fn();
    // main thread render
    {
      __root.__jsx = [createCompMT1('ref1'), createCompMT1('mts'), createCompMT1('mts')];
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
          </view>
          <view>
            <view
              has-react-ref={true}
            />
          </view>
          <view>
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render([createCompBG1('ref1'), createCompBG1('mts'), createCompBG1('mts')], __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"workletRefInitValuePatch":[[5,null],[6,null],[7,null],[8,null],[9,null],[10,null]]}",
              "patchOptions": {
                "commitTaskId": 5,
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"snapshotPatch":[3,-2,0,{"_wvid":5},3,-3,0,{"_wkltId":233,"_execId":2},3,-4,0,{"_wkltId":233,"_execId":3}]}",
              "patchOptions": {
                "commitTaskId": 6,
                "isHydration": true,
                "pipelineOptions": {
                  "needTimestamps": true,
                  "pipelineID": "pipelineID",
                },
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.runWorklet.mockClear();
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRefInitValueChanges.mockClear();
      let rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[1];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 5,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 2,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              {
                "elementRefptr": <view
                  has-react-ref={true}
                />,
              },
            ],
          ],
          [
            {
              "_execId": 3,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              {
                "elementRefptr": <view
                  has-react-ref={true}
                />,
              },
            ],
          ],
        ]
      `);
      globalThis.runWorklet.mock.calls[1][0]._unmount = cleanup;
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render([createCompBG1('ref2'), createCompBG1('ref1'), createCompBG1('mts')], __root);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"snapshotPatch":[3,-2,0,{"_wvid":6},3,-3,0,{"_wvid":7},3,-4,0,{"_wkltId":233,"_execId":4}]}",
              "patchOptions": {
                "commitTaskId": 7,
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `);

      globalEnvManager.switchToMainThread();
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      globalThis.runWorklet.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 5,
            },
            null,
          ],
          [
            {
              "_wvid": 6,
            },
            <view
              has-react-ref={true}
            />,
          ],
          [
            {
              "_wvid": 7,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 2,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              null,
            ],
          ],
          [
            {
              "_execId": 4,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              {
                "elementRefptr": <view
                  has-react-ref={true}
                />,
              },
            ],
          ],
        ]
      `);
      expect(cleanup).toBeCalled();
    }
  });

  it('insert & remove element', async function() {
    // main thread render
    {
      __root.__jsx = null;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(null, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // insert
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render([createCompBG1('ref1'), createCompBG1('mts')], __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
          </view>
          <view>
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 11,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 5,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              {
                "elementRefptr": <view
                  has-react-ref={true}
                />,
              },
            ],
          ],
        ]
      `);
    }

    // remove
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      globalThis.runWorklet.mockClear();
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      render(null, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 11,
            },
            null,
          ],
        ]
      `);
      expect(globalThis.runWorklet.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_execId": 5,
              "_unmount": undefined,
              "_wkltId": 233,
            },
            [
              null,
            ],
          ],
        ]
      `);
    }
  });

  it('invalid ref type', async function() {
    // main thread render
    {
      __root.__jsx = createCompMT1('number');
      expect(() => renderPage()).toThrowError(
        'MainThreadRef: main-thread:ref must be of type MainThreadRef or main-thread function.',
      );
    }
  });
});

describe('WorkletRef in list', () => {
  it('hydrate', async function() {
    const refs = [{
      _wvid: 233,
    }, {
      _wvid: 234,
    }, {
      _wvid: 235,
    }];
    const signs = [0, 0, 0];

    // main thread render
    {
      __root.__jsx = createCompMTList(refs);
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <list
            update-list-info={
              [
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_4",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_4",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_4",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          />
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(createCompBGList(refs), __root);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // list render item 1 & 2
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      signs[0] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 0);
      signs[1] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 233,
            },
            <view
              has-react-ref={true}
            />,
          ],
          [
            {
              "_wvid": 234,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
    }

    // list enqueue item 1 & render item 3
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[0]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 2);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 233,
            },
            null,
          ],
          [
            {
              "_wvid": 235,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
    }

    // list enqueue item 2 & render item 2
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[1]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`[]`);
    }
  });
});

describe('WorkletRef in spread', () => {
  it('insert & remove', async function() {
    // main thread render
    {
      __root.__jsx = createCompMTSpread('null');
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view />
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(createCompBGSpread('null'), __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // insert
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(createCompBGSpread('ref'), __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 15,
            },
            <view
              has-react-ref={true}
            />,
          ],
        ]
      `);
    }

    // remove
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
      globalThis.runWorklet.mockClear();
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(createCompBGSpread('null'), __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "_wvid": 15,
            },
            null,
          ],
        ]
      `);
    }
  });
});
