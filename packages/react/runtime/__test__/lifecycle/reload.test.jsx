/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicBG, ListBG, ListConditionalBG, ViewBG, setObj, setStr } from './reloadBG';
import { BasicMT, ListConditionalMT, ListMT, ViewMT } from './reloadMT';
import { root } from '../../src/index';
import { delayedEvents, delayedPublishEvent } from '../../src/lifecycle/event/delayEvents';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { reloadBackground } from '../../src/lifecycle/reload';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));

  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();

  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('reload', () => {
  it('basic', async function() {
    // main thread render
    {
      __root.__jsx = BasicMT;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(BasicBG, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":2}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        }
      `);
      lynx.getNativeApp().callLepusMethod.mock.calls[0][2]();
      await waitSchedule();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // update
    {
      setStr('update');
      setObj({ dataX2: 'WorldX2' });
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":3,"snapshotPatch":[3,-2,0,{"dataX2":"WorldX2"},3,-5,0,"update",3,-3,0,{"attr":{"dataX2":"WorldX2"}}]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 0,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
            <view
              attr={
                {
                  "dataX2": "WorldX2",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX2": "WorldX2",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // another update
    {
      globalEnvManager.switchToBackground();
      setStr('???');
      await waitSchedule();
    }

    // MT reload
    {
      globalEnvManager.switchToMainThread();
      updatePage({ text: 'Enjoy' }, { reloadTemplate: true });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Enjoy"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // update before reload should be ignored
    {
      globalEnvManager.switchToBackground();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":4,"snapshotPatch":[3,-5,0,"???"]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 0,
          },
        }
      `);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Enjoy"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // BG reload
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.onAppReload({ text: 'Enjoy' });
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "root": "{"id":-6,"type":"root","children":[{"id":-7,"type":"__Card__:__snapshot_a94a8_test_2","values":[{"dataX":"WorldX"}],"children":[{"id":-9,"type":null,"values":["Enjoy"]},{"id":-10,"type":null,"values":["World"]},{"id":-8,"type":"__Card__:__snapshot_a94a8_test_1","values":[{"attr":{"dataX":"WorldX"}}]}]}]}",
              },
            ],
          ],
        ]
      `);
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":7}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 2,
          },
        }
      `);
      lynx.getNativeApp().callLepusMethod.mock.calls[0][2]();
      await waitSchedule();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Enjoy"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      setStr('update');
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":8,"snapshotPatch":[3,-10,0,"update"]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 2,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Enjoy"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }
  });

  it('when first level of jsx is not component', async function() {
    // main thread render
    {
      __root.__jsx = ViewMT;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="World"
                />
              </text>
              <view
                attr={
                  {
                    "dataX": "WorldX",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX": "WorldX",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(ViewBG, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":10}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 2,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // update
    {
      globalEnvManager.switchToBackground();
      setStr('update');
      setObj({ dataX2: 'WorldX2' });
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":11,"snapshotPatch":[3,-2,0,{"dataX2":"WorldX2"},3,-5,0,"update",3,-3,0,{"attr":{"dataX2":"WorldX2"}}]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 2,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="update"
                />
              </text>
              <view
                attr={
                  {
                    "dataX2": "WorldX2",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX2": "WorldX2",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }

    // another update
    {
      globalEnvManager.switchToBackground();
      setStr('???');
      await waitSchedule();
    }

    // MT reload
    {
      globalEnvManager.switchToMainThread();
      updatePage({ text: 'Enjoy' }, { reloadTemplate: true });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Enjoy"
                />
              </text>
              <text>
                <raw-text
                  text="World"
                />
              </text>
              <view
                attr={
                  {
                    "dataX": "WorldX",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX": "WorldX",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }

    // update before reload should be ignored
    {
      globalEnvManager.switchToBackground();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":12,"snapshotPatch":[3,-5,0,"???"]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 2,
          },
        }
      `);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Enjoy"
                />
              </text>
              <text>
                <raw-text
                  text="World"
                />
              </text>
              <view
                attr={
                  {
                    "dataX": "WorldX",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX": "WorldX",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }

    // BG reload
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.onAppReload({ text: 'Enjoy' });
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "root": "{"id":-6,"type":"root","children":[{"id":-9,"type":"__Card__:__snapshot_a94a8_test_3","children":[{"id":-7,"type":"__Card__:__snapshot_a94a8_test_2","values":[{"dataX":"WorldX"}],"children":[{"id":-10,"type":null,"values":["Enjoy"]},{"id":-11,"type":null,"values":["World"]},{"id":-8,"type":"__Card__:__snapshot_a94a8_test_1","values":[{"attr":{"dataX":"WorldX"}}]}]}]}]}",
              },
            ],
          ],
        ]
      `);
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":15}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 4,
          },
        }
      `);
      lynx.getNativeApp().callLepusMethod.mock.calls[0][2]();
      await waitSchedule();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Enjoy"
                />
              </text>
              <text>
                <raw-text
                  text="World"
                />
              </text>
              <view
                attr={
                  {
                    "dataX": "WorldX",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX": "WorldX",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      setStr('update');
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"id":16,"snapshotPatch":[3,-11,0,"update"]}]}",
          "patchOptions": {
            "flowIds": [
              666,
            ],
            "reloadVersion": 4,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2];
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="Enjoy"
                />
              </text>
              <text>
                <raw-text
                  text="update"
                />
              </text>
              <view
                attr={
                  {
                    "dataX": "WorldX",
                  }
                }
              />
              <wrapper>
                <view
                  attr={
                    {
                      "attr": {
                        "dataX": "WorldX",
                      },
                    }
                  }
                />
              </wrapper>
            </view>
          </view>
        </page>
      `);
    }
  });

  it('with list', async function() {
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
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
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "jsReadyEventIdSwap": {},
                "root": "{"id":-1,"type":"root","children":[{"id":-5,"type":"__Card__:__snapshot_a94a8_test_5","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":0}],"children":[{"id":-6,"type":"__Card__:__snapshot_a94a8_test_4","values":["a"]}]},{"id":-3,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":1}],"children":[{"id":-7,"type":"__Card__:__snapshot_a94a8_test_4","values":["b"]}]},{"id":-4,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":2}],"children":[{"id":-8,"type":"__Card__:__snapshot_a94a8_test_4","values":["c"]}]}]}]}",
              },
            ],
          ],
        ]
      `)
      debugger
      expect(lynxCoreInject.tt.OnLifecycleEvent).toMatchInlineSnapshot(`[Function]`)
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"snapshotPatch":[],"id":18}]}",
              "patchOptions": {
                "isHydration": true,
                "pipelineOptions": {
                  "dsl": "reactLynx",
                  "needTimestamps": true,
                  "pipelineID": "pipelineID",
                  "pipelineOrigin": "reactLynxHydrate",
                  "stage": "hydrate",
                },
                "reloadVersion": 4,
              },
            },
            [Function],
          ],
        ]
      `)
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
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
                attr="a"
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                attr="b"
              />
            </list-item>
          </list>
        </page>
      `);
    }

    // updateData
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setObj(['d', 'e', 'f']);
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":19,"snapshotPatch":[3,-6,0,"d",3,-7,0,"e",3,-8,0,"f"]}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 4,
              },
            },
            [Function],
          ],
        ]
      `);

      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`[]`);
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
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
                attr="d"
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                attr="e"
              />
            </list-item>
          </list>
        </page>
      `);
    }

    // MT reload
    {
      globalEnvManager.switchToMainThread();
      updatePage({ text: 'Enjoy' }, { reloadTemplate: true });
    }

    // The rendered two items should be updated by `updatePage`
    // without componentAtIndex
    {
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
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
                attr="a"
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                attr="b"
              />
            </list-item>
          </list>
        </page>
      `);
    }
  });
});

describe('firstScreenSyncTiming - jsReady', () => {
  beforeAll(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
  });

  afterAll(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  it('basic', async function() {
    // main thread render
    {
      __root.__jsx = BasicMT;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // main thread update 1
    {
      updatePage({
        text: 'Hello 1',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello 1"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // main thread update 2
    {
      updatePage({
        text: 'Hello 2',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello 2"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(ViewBG, __root);

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0]).toMatchInlineSnapshot(`
        [
          "rLynxJSReady",
          {},
        ]
      `);
      globalEnvManager.switchToMainThread();
      const rLynxJSReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxJSReady[0]](rLynxJSReady[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      expect(globalThis.__OnLifecycleEvent).toHaveBeenCalledTimes(1);
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(rLynxFirstScreen).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {
                "-1": -6,
                "-10": -15,
                "-2": -7,
                "-3": -8,
                "-4": -9,
                "-5": -10,
                "-6": -11,
                "-7": -12,
                "-8": -13,
                "-9": -14,
              },
              "root": "{"id":-11,"type":"root","children":[{"id":-12,"type":"__Card__:__snapshot_a94a8_test_2","values":[{"dataX":"WorldX"}],"children":[{"id":-14,"type":null,"values":["Hello 2"]},{"id":-15,"type":null,"values":["World"]},{"id":-13,"type":"__Card__:__snapshot_a94a8_test_1","values":[{"attr":{"dataX":"WorldX"}}]}]}]}",
            },
          ],
        ]
      `);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[2,-11,-12,0,"__Card__:__snapshot_a94a8_test_3",2,0,0,"__Card__:__snapshot_a94a8_test_2",3,0,4,3,[{"dataX":"WorldX"}],0,null,4,0,4,4,["Hello 2"],1,3,4,null,0,null,5,1,4,5,["World"],1,3,5,null,0,"__Card__:__snapshot_a94a8_test_1",6,2,4,6,[{"attr":{"dataX":"WorldX"}}],1,3,6,null,1,2,3,null,1,-11,2,null],"id":21}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 5,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }
  });

  it('basic - with list', async function() {
    // main thread render
    {
      __root.__jsx = ListMT;
      renderPage({
        text: 'Hello',
      });
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
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

    // main thread update 1
    {
      updatePage({
        text: 'Hello 1',
      });
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          />
        </page>
      `);
    }

    // main thread update 2
    {
      updatePage({
        text: 'Hello 2',
      });
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
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_6",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
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
      root.render(ListBG, __root);

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0]).toMatchInlineSnapshot(`
        [
          "rLynxJSReady",
          {},
        ]
      `);
      globalEnvManager.switchToMainThread();
      const rLynxJSReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxJSReady[0]](rLynxJSReady[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(rLynxFirstScreen).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {
                "-1": -9,
                "-13": -21,
                "-5": -13,
                "-9": -17,
              },
              "root": "{"id":-17,"type":"root","children":[{"id":-21,"type":"__Card__:__snapshot_a94a8_test_5","children":[{"id":-18,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":0}],"children":[{"id":-22,"type":"__Card__:__snapshot_a94a8_test_4","values":["a"]}]},{"id":-19,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":1}],"children":[{"id":-23,"type":"__Card__:__snapshot_a94a8_test_4","values":["b"]}]},{"id":-20,"type":"__Card__:__snapshot_a94a8_test_6","values":[{"item-key":2}],"children":[{"id":-24,"type":"__Card__:__snapshot_a94a8_test_4","values":["c"]}]}]}]}",
            },
          ],
        ]
      `);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":23}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 5,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }
  });

  it('basic - with list conditional', async function() {
    // main thread render
    {
      __root.__jsx = ListConditionalMT;
      renderPage({
        shouldRender: false,
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
    }

    // main thread update 1
    {
      updatePage({
        shouldRender: true,
      });
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
                      "type": "__Card__:__snapshot_a94a8_test_8",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_8",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_8",
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

    // main thread update 2
    {
      updatePage({
        shouldRender: true,
      });
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
                      "type": "__Card__:__snapshot_a94a8_test_8",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_8",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_8",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
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
      root.render(ListConditionalBG, __root);

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0]).toMatchInlineSnapshot(`
        [
          "rLynxJSReady",
          {},
        ]
      `);
      globalEnvManager.switchToMainThread();
      const rLynxJSReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxJSReady[0]](rLynxJSReady[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(rLynxFirstScreen).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {
                "-1": -2,
                "-2": -10,
                "-6": -14,
              },
              "root": "{"id":-10,"type":"root","children":[{"id":-14,"type":"__Card__:__snapshot_a94a8_test_7","children":[{"id":-11,"type":"__Card__:__snapshot_a94a8_test_8","values":[{"item-key":0}],"children":[{"id":-15,"type":"__Card__:__snapshot_a94a8_test_4","values":["a"]}]},{"id":-12,"type":"__Card__:__snapshot_a94a8_test_8","values":[{"item-key":1}],"children":[{"id":-16,"type":"__Card__:__snapshot_a94a8_test_4","values":["b"]}]},{"id":-13,"type":"__Card__:__snapshot_a94a8_test_8","values":[{"item-key":2}],"children":[{"id":-17,"type":"__Card__:__snapshot_a94a8_test_4","values":["c"]}]}]}]}",
            },
          ],
        ]
      `);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":25}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 5,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }
  });

  it('reload template before js ready', async function() {
    // main thread render
    {
      __root.__jsx = BasicMT;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // main thread update 1
    {
      updatePage({
        text: 'Hello 1',
      }, { reloadTemplate: true });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello 1"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // main thread update 2
    {
      updatePage({
        text: 'Hello 2',
      }, { reloadTemplate: true });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello 2"
              />
            </text>
            <text>
              <raw-text
                text="World"
              />
            </text>
            <view
              attr={
                {
                  "dataX": "WorldX",
                }
              }
            />
            <wrapper>
              <view
                attr={
                  {
                    "attr": {
                      "dataX": "WorldX",
                    },
                  }
                }
              />
            </wrapper>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(ViewBG, __root);

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0]).toMatchInlineSnapshot(`
        [
          "rLynxJSReady",
          {},
        ]
      `);
      globalEnvManager.switchToMainThread();
      const rLynxJSReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxJSReady[0]](rLynxJSReady[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      expect(globalThis.__OnLifecycleEvent).toHaveBeenCalledTimes(1);
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(rLynxFirstScreen).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "root": "{"id":-11,"type":"root","children":[{"id":-12,"type":"__Card__:__snapshot_a94a8_test_2","values":[{"dataX":"WorldX"}],"children":[{"id":-14,"type":null,"values":["Hello 2"]},{"id":-15,"type":null,"values":["World"]},{"id":-13,"type":"__Card__:__snapshot_a94a8_test_1","values":[{"attr":{"dataX":"WorldX"}}]}]}]}",
            },
          ],
        ]
      `);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[2,-11,-12,0,"__Card__:__snapshot_a94a8_test_3",2,0,0,"__Card__:__snapshot_a94a8_test_2",3,0,4,3,[{"dataX":"WorldX"}],0,null,4,0,4,4,["Hello 2"],1,3,4,null,0,null,5,1,4,5,["World"],1,3,5,null,0,"__Card__:__snapshot_a94a8_test_1",6,2,4,6,[{"attr":{"dataX":"WorldX"}}],1,3,6,null,1,2,3,null,1,-11,2,null],"id":27}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 7,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }
  });

  it('should clear cached events before reload when js not ready', async function() {
    delayedPublishEvent('bindEvent:tap', 'test');
    expect(delayedEvents.length).toBe(1);
    reloadBackground({});
    expect(delayedEvents.length).toBe(0);
  });
});
