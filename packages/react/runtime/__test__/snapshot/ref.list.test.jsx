/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { renderBackground as render } from '../../src/lifecycle/render';
import { __pendingListUpdates } from '../../src/list';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

import { ListMT, refsMT } from './refListMT';
import { ListBG, refsBG } from './refListBG';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));

  replaceCommitHook();
  injectUpdateMainThread();
  globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = true;
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();

  globalEnvManager.resetEnv();
  elementTree.clear();
  __pendingListUpdates.clear();
});

describe('element ref in list', () => {
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
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-6:0:":3}",
              },
            ],
          ],
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-7:0:":5}",
              },
            ],
          ],
        ]
      `);
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[1]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refsBG[0]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 3,
          },
        }
      `);
      expect(refsBG[1]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 5,
          },
        }
      `);
      expect(refsBG[2].current).toBeNull();
    }

    // list enqueue item 1 & render item 3
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[0]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 2);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-6:0:":null,"-8:0:":3}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refsMT[0].current).toBeNull();
      expect(refsMT[1]).toMatchInlineSnapshot(`
        {
          "current": null,
        }
      `);
      expect(refsMT[2]).toMatchInlineSnapshot(`
        {
          "current": null,
        }
      `);
    }

    // list enqueue item 2 & render item 2
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[1]);
      elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`[]`);
    }
  });

  it('continuously reuse', async function() {
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

    // list render item 1
    {
      signs[0] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 0);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-6:0:":9}",
              },
            ],
          ],
        ]
      `);
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      expect(refsBG[0]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 9,
          },
        }
      `);
      expect(refsBG[1]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 5,
          },
        }
      `);
      expect(refsBG[2].current).toBeNull();
    }

    // list enqueue item 1 & render item 2
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[0]);
      signs[1] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 1);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-6:0:":null,"-7:0:":9}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      expect(refsMT[0].current).toBeNull();
      expect(refsMT[1]).toMatchInlineSnapshot(`
        {
          "current": null,
        }
      `);
      expect(refsMT[2].current).toBeNull();
    }

    // list enqueue item 2 & render item 3
    {
      globalEnvManager.switchToMainThread();
      elementTree.triggerEnqueueComponent(__root.childNodes[0].__elements[0], signs[1]);
      signs[2] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 2);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-7:0:":null,"-8:0:":9}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      expect(refsMT[0].current).toBeNull();
      expect(refsMT[1].current).toBeNull();
      expect(refsMT[2]).toMatchInlineSnapshot(`
        {
          "current": null,
        }
      `);
    }
  });
});
