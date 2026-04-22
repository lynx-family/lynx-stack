/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree, waitSchedule } from './utils/nativeMethod';
import { setupPage } from '../../src/snapshot';
import { createElement as createElementBackground } from 'preact/compat';
import { createElement as createElementMainThread } from '../../lepus/index.js';
import { createElement } from '../../src/snapshot/lynx/element';
import { __root } from '../../src/root';
import { globalEnvManager } from './utils/envManager';
import { snapshotManager } from '../../src/snapshot';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { __globalSnapshotPatch, initGlobalSnapshotPatch } from '../../src/snapshot/lifecycle/patch/snapshotPatch';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { clearCommitTaskId, replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  clearCommitTaskId();
});

afterEach(() => {
  vi.restoreAllMocks();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('createElement', () => {
  it('view with className', async function() {
    let element;
    const App = () => {
      element = createElement('view', {
        className: __MAIN_THREAD__ ? 'a' : 'b',
      });
      return element;
    };
    __root.__jsx = <App />;
    renderPage();
    expect(element.type).toBe('view');
    expect(element.props.className).toBe('a');
    expect(element.__snapshot_def.isListHolder).toBe(false);
    expect(element.__snapshot_def.spreadIndex).toBe(0);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        />
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild.__snapshot_def).toMatchInlineSnapshot(`
        {
          "create": [Function],
          "isListHolder": false,
          "slot": [
            [
              6,
              0,
            ],
          ],
          "spreadIndex": 0,
          "update": [
            [Function],
          ],
        }
      `);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            class="b"
          />
        </page>
      `);
    }
  });

  it('view with style', function() {
    const App = () => {
      return (__MAIN_THREAD__ ? createElementMainThread : createElementBackground)('view', {
        style: {
          color: 'red',
        },
      });
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__firstChild).toMatchInlineSnapshot(`
      {
        "children": undefined,
        "extraProps": {
          "style": {
            "color": "red",
          },
        },
        "id": -2,
        "type": "view",
        "values": [
          {
            "style": {
              "color": "red",
            },
          },
        ],
      }
    `);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          style={
            {
              "color": "red",
            }
          }
        />
      </page>
    `);
    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild.__extraProps).toStrictEqual({
        style: {
          color: 'red',
        },
      });
      expect(__root.__firstChild.__snapshot_def).toMatchInlineSnapshot(`
        {
          "create": [Function],
          "isListHolder": false,
          "slot": [
            [
              6,
              0,
            ],
          ],
          "spreadIndex": 0,
          "update": [
            [Function],
          ],
        }
      `);
    }
  });

  it('view with event', async function() {
    const handleTap = vi.fn();
    let element;
    const App = () => {
      element = (__MAIN_THREAD__ ? createElementMainThread : createElementBackground)('view', {
        bindtap: handleTap,
      });
      return element;
    };
    __root.__jsx = <App />;
    renderPage();
    expect(element.type).toBe('view');
    expect(element.props.bindtap).toBe(1);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          event={
            {
              "bindEvent:tap": "-2:0:bindtap",
            }
          }
        />
      </page>
    `);

    globalEnvManager.switchToBackground();
    render(<App />, __root);

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    lynxCoreInject.tt.publishEvent('-2:0:bindtap', 'data');
    expect(handleTap).toHaveBeenCalledTimes(1);
    expect(handleTap).toHaveBeenCalledWith('data');
  });

  it('view with one child', function() {
    const App = () => {
      return (__MAIN_THREAD__ ? createElementMainThread : createElementBackground)(
        'view',
        {
          className: 'a',
        },
        <text>Hello</text>,
      );
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__firstChild).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": undefined,
            "extraProps": undefined,
            "id": -3,
            "type": "__snapshot_a94a8_test_1",
            "values": undefined,
          },
        ],
        "extraProps": {
          "className": "a",
        },
        "id": -2,
        "type": "view",
        "values": [
          {
            "className": "a",
          },
        ],
      }
    `);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        >
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild).toStrictEqual(__root.__lastChild);
      expect(__root.__firstChild.__snapshot_def).toMatchInlineSnapshot(`
        {
          "create": [Function],
          "isListHolder": false,
          "slot": [
            [
              6,
              0,
            ],
          ],
          "spreadIndex": 0,
          "update": [
            [Function],
          ],
        }
      `);
      expect(__root.__firstChild.__firstChild.type).toBe('__snapshot_a94a8_test_1');
    }
  });

  it('view with multiple children', async function() {
    const App = () => {
      return createElement(
        'view',
        {
          className: 'a',
        },
        <text>Hello</text>,
        __MAIN_THREAD__ ? undefined : createElementBackground('text', {}, [
          'Hello',
          'World',
        ]),
      );
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__firstChild).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": undefined,
            "extraProps": undefined,
            "id": -3,
            "type": "__snapshot_a94a8_test_2",
            "values": undefined,
          },
        ],
        "extraProps": {
          "className": "a",
        },
        "id": -2,
        "type": "view",
        "values": [
          {
            "className": "a",
          },
        ],
      }
    `);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        >
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild.__snapshot_def).toMatchInlineSnapshot(`
        {
          "create": [Function],
          "isListHolder": false,
          "slot": [
            [
              6,
              0,
            ],
          ],
          "spreadIndex": 0,
          "update": [
            [Function],
          ],
        }
      `);
      expect(__root.__firstChild.__firstChild.type).toBe('__snapshot_a94a8_test_2');
      expect(__root.__firstChild.__lastChild.type).toBe('text');
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            class="a"
          >
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <text>
              <raw-text
                text="Hello"
              />
              <raw-text
                text="World"
              />
            </text>
          </view>
        </page>
      `);
    }
  });

  it('view created multiple times', async function() {
    const App = () => {
      const createFunc = __MAIN_THREAD__ ? createElementMainThread : createElementBackground;
      const element1 = createFunc('view', {
        className: 'a',
      });
      const element2 = createFunc('view', {
        className: 'b',
      });
      return (
        <view>
          {element1}
          {element2}
        </view>
      );
    };
    expect(snapshotManager.values.keys()).toContain('view');
    expect(snapshotManager.values.get('view')).toMatchInlineSnapshot(`
      {
        "create": [Function],
        "isListHolder": false,
        "slot": [
          [
            6,
            0,
          ],
        ],
        "spreadIndex": 0,
        "update": [
          [Function],
        ],
      }
    `);
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <view
            class="a"
          />
          <view
            class="b"
          />
        </view>
      </page>
    `);
  });

  it('view created in background thread', async function() {
    let element, setCount;
    const App = () => {
      const [count, _setCount] = useState(0);
      setCount = _setCount;
      element = __MAIN_THREAD__ ? null : createElementBackground('view', {
        className: `a-${count}`,
        style: {
          color: 'red',
        },
        bindtap: vi.fn(),
      });
      return element;
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);

    globalEnvManager.switchToBackground();
    render(<App />, __root);

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            class="a-0"
            event={
              {
                "bindEvent:tap": "2:0:bindtap",
              }
            }
            style={
              {
                "color": "red",
              }
            }
          />
        </page>
      `);
    }

    // set count
    {
      lynx.getNativeApp().callLepusMethod.mockClear();
      globalEnvManager.switchToBackground();
      setCount(1);
      await waitSchedule();
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            class="a-1"
            event={
              {
                "bindEvent:tap": "2:0:bindtap",
              }
            }
            style={
              {
                "color": "red",
              }
            }
          />
        </page>
      `);
    }
  });

  it('list with className and children', async function() {
    function App() {
      return (__MAIN_THREAD__ ? createElementMainThread : createElementBackground)(
        'list',
        {
          className: __MAIN_THREAD__ ? 'a' : 'b',
        },
        <list-item item-key='0'>Hello</list-item>,
        __MAIN_THREAD__ ? <list-item item-key='1'>World</list-item> : undefined,
      );
    }
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__firstChild.__snapshot_def).toMatchInlineSnapshot(`
      {
        "create": [Function],
        "isListHolder": true,
        "slot": [
          [
            7,
            0,
          ],
        ],
        "spreadIndex": 0,
        "update": [
          [Function],
        ],
      }
    `);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <list
          class="a"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "0",
                    "position": 0,
                    "type": "__snapshot_a94a8_test_4",
                  },
                  {
                    "item-key": "1",
                    "position": 1,
                    "type": "__snapshot_a94a8_test_5",
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
    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild.type).toMatchInlineSnapshot(`"list"`);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <list
            class="b"
            update-list-info={
              [
                {
                  "insertAction": [
                    {
                      "item-key": "0",
                      "position": 0,
                      "type": "__snapshot_a94a8_test_4",
                    },
                    {
                      "item-key": "1",
                      "position": 1,
                      "type": "__snapshot_a94a8_test_5",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
                {
                  "insertAction": [],
                  "removeAction": [
                    1,
                  ],
                  "updateAction": [],
                },
              ]
            }
          />
        </page>
      `);
    }
  });

  it('component with props', async function() {
    function Comp(props) {
      return <view className={props.className}>{props.children}</view>;
    }
    function App() {
      return (__MAIN_THREAD__ ? createElementMainThread : createElementBackground)(
        Comp,
        {
          className: 'a',
        },
        <text>Hello</text>,
        __MAIN_THREAD__ ? <text>World</text> : null,
      );
    }
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__firstChild).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": undefined,
            "extraProps": undefined,
            "id": -3,
            "type": "__snapshot_a94a8_test_7",
            "values": undefined,
          },
          {
            "children": undefined,
            "extraProps": undefined,
            "id": -4,
            "type": "__snapshot_a94a8_test_8",
            "values": undefined,
          },
        ],
        "extraProps": undefined,
        "id": -2,
        "type": "__snapshot_a94a8_test_6",
        "values": [
          "a",
        ],
      }
    `);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        >
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
        </view>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(__root.__firstChild.type).toMatchInlineSnapshot(`"__snapshot_a94a8_test_6"`);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            class="a"
          >
            <text>
              <raw-text
                text="Hello"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});
