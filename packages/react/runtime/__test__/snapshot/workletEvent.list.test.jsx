/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { renderBackground as render } from '../../src/lifecycle/render';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

import { ListMT } from './workletEventMT';
import { ListBG } from './workletEventBG';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();

  globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = true;
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('WorkletEvent in list', () => {
  it('hydrate', async function() {
    const signs = [0, 0, 0];

    // main thread render
    {
      __root.__jsx = ListMT;
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
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_3",
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
      render(ListBG, __root);
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
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`[]`);
    }

    // list render item 1 & 2
    {
      signs[0] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 0);
      signs[1] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
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
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key={0}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 1,
                        "_wkltId": "835d:450ef:0",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 2,
                        "_wkltId": "835d:450ef:1",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
          </list>
        </page>
      `);
    }

    // list enqueue item 1 & render item 3
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[0]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 2);
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
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key={2}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 3,
                        "_wkltId": "835d:450ef:2",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 2,
                        "_wkltId": "835d:450ef:1",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
          </list>
        </page>
      `);
    }

    // list enqueue item 2 & render item 2
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[1]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
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
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [
                    {
                      "item-key": 0,
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_3",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key={2}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 3,
                        "_wkltId": "835d:450ef:2",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                event={
                  {
                    "bindEvent:tap": {
                      "type": "worklet",
                      "value": {
                        "_execId": 2,
                        "_wkltId": "835d:450ef:1",
                        "_workletType": "main-thread",
                      },
                    },
                  }
                }
              />
            </list-item>
          </list>
        </page>
      `);
    }
  });
});
