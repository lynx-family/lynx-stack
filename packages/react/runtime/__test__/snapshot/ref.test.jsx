/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Component, createRef, root, useState } from '../../src/index';
import { delayedLifecycleEvents } from '../../src/lifecycle/event/delayLifecycleEvents';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { renderBackground as render } from '../../src/lifecycle/render';
import { __pendingListUpdates } from '../../src/list';
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
  __pendingListUpdates.clearAttachedLists();
});

describe('component ref', () => {
  it('basic', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Child extends Component {
      x = 'x';
      render() {
        return <view />;
      }
    }

    class Comp extends Component {
      x = 'x';
      render() {
        return this.props.show && (
          <view>
            <Child ref={ref1} />
            <Child ref={ref2} />
          </view>
        );
      }
    }

    globalEnvManager.switchToBackground();
    render(<Comp show={true} />, __root);
    expect(ref1).toBeCalledWith(expect.objectContaining({
      x: 'x',
    }));
    expect(ref2.current).toHaveProperty('x', 'x');
    ref1.mockClear();

    render(<Comp show={false} />, __root);
    expect(ref1).toBeCalledWith(null);
    // TODO: check the behavior to this failed test
    // expect(ref2.current).toBe(null);
  });
});

describe('element ref', () => {
  it('basic', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls[0]).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "refPatch": "{"-2:0:":3,"-2:1:":4}",
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_3","values":["-2:0:","-2:1:"]}]}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      expect(ref1).not.toBeCalled();
      expect(ref2.current).toBe(null);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":4}]}"`,
      );
      lynx.getNativeApp().callLepusMethod.mock.calls[0][2]();
      await waitSchedule();

      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 3,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 4,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }
  });

  it('insert', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Comp extends Component {
      x = 'x';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp show={false} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={false} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // insert node
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":7,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_4",2,4,2,[3,4],1,-1,2,null]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 7,
                "refPatch": "{"2:0:":7,"2:1:":8}",
              },
            ],
          ],
        ]
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 7,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 8,
          },
        }
      `);
    }

    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":8,"snapshotPatch":[3,2,0,3,3,2,1,4]}]}"`,
      );
    }
  });

  it('remove', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();

    class Comp extends Component {
      x = 'x';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // remove node
    {
      ref1.mockClear();
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={false} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":11,"snapshotPatch":[2,-1,-2]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 11,
                "refPatch": "{"-2:0:":null,"-2:1:":null}",
              },
            ],
          ],
        ]
      `);
    }

    // ref patch
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            null,
          ],
        ]
      `);
      expect(ref2.current).toBeNull();
    }
  });

  it('remove with cleanup function', async function() {
    const cleanup = vi.fn();
    const ref1 = vi.fn(() => {
      return cleanup;
    });

    class Comp extends Component {
      x = 'x';
      render() {
        return this.props.show && (
          <view>
            <view ref={ref1} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // remove node
    {
      ref1.mockClear();
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={false} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":14,"snapshotPatch":[2,-1,-2]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 14,
                "refPatch": "{"-2:0:":null}",
              },
            ],
          ],
        ]
      `);
    }

    // ref patch
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1).not.toBeCalled();
      expect(cleanup.mock.calls).toMatchInlineSnapshot(`
        [
          [],
        ]
      `);
    }
  });

  it('callback should ref and unref deeply', async () => {
    const ref1 = [vi.fn(), vi.fn(), vi.fn()];
    const ref2 = vi.fn();
    let _setShow;

    function ComponentWithRef({ index }) {
      return <view ref={ref1[index]} />;
    }

    function App() {
      const [show, setShow] = useState(true);
      _setShow = setShow;
      return (
        show && (
          <view ref={ref2}>
            {[0, 1, 2].map(i => {
              return <ComponentWithRef index={i} />;
            })}
          </view>
        )
      );
    }

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    ref1.forEach(ref => {
      expect(ref).toHaveBeenCalledWith(expect.objectContaining({
        uid: expect.any(Number),
      }));
    });
    expect(ref2).toHaveBeenCalledWith(expect.objectContaining({
      uid: expect.any(Number),
    }));
    ref1.forEach(ref => ref.mockClear());
    ref2.mockClear();

    // remove node
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      _setShow(false);
      await waitSchedule();
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 17,
                "refPatch": "{"-2:0:":null,"-3:0:":null,"-4:0:":null,"-5:0:":null}",
              },
            ],
          ],
        ]
      `);
    }

    // ref patch
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      ref1.forEach(ref => expect(ref).toHaveBeenCalledWith(null));
      expect(ref2).toHaveBeenCalledWith(null);
    }
  });

  it('hydrate', async function() {
    const ref1 = createRef();
    const ref2 = createRef();
    const ref3 = vi.fn();

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view ref={this.props.switch ? ref1 : null} />
            <view ref={this.props.switch ? null : ref2} />
            <view ref={this.props.switch ? null : ref3} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp switch={true} />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
            <view />
            <view />
          </view>
        </page>
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls[0]).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "refPatch": "{"-2:0:":23}",
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_9","values":["-2:0:",null,null]}]}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp switch={false} />, __root);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[3,-2,0,null,3,-2,1,13,3,-2,2,14],"id":19}]}"`,
      );

      expect(ref1.current).toBeNull();
      expect(ref2.current).toBeNull();
      expect(ref3).not.toBeCalled();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              has-react-ref={true}
            />
            <view
              has-react-ref={true}
            />
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);

      // ref patch
      {
        globalEnvManager.switchToBackground();
        lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
        await waitSchedule();
        expect(ref1.current).toBeNull();
        expect(ref2).toMatchInlineSnapshot(`
          {
            "current": {
              "selectUniqueID": [Function],
              "uid": 24,
            },
          }
        `);
        expect(ref3.mock.calls).toMatchInlineSnapshot(`
          [
            [
              {
                "selectUniqueID": [Function],
                "uid": 25,
              },
            ],
          ]
        `);
      }
    }
  });

  it('change before hydration', async function() {
    const ref1 = createRef();
    const ref2 = createRef();

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view ref={this.props.switch ? ref1 : null} />
            <view ref={this.props.switch ? null : ref2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp switch={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp switch={true} />, __root);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // background state change
    {
      render(<Comp switch={false} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[3,-2,0,null,3,-2,1,16],"id":22}]}"`,
      );
      globalThis.__OnLifecycleEvent.mockClear();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();

      // ref patch
      {
        globalEnvManager.switchToBackground();
        lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
        await waitSchedule();
        expect(ref1.current).toBeNull();
        expect(ref2).toMatchInlineSnapshot(`
          {
            "current": {
              "selectUniqueID": [Function],
              "uid": 29,
            },
          }
        `);
      }
    }
  });

  it('wrong ref type', async function() {
    let ref1 = 1;

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view ref={ref1} />
          </view>
        );
      }
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      expect(() => {
        render(<Comp />, __root);
      }).toThrowError(
        'Elements\' "ref" property should be a function, or an object created by createRef(), but got [number] instead',
      );
    }

    ref1 = {};

    // background render
    {
      globalEnvManager.resetEnv();
      globalEnvManager.switchToBackground();
      expect(() => {
        render(<Comp />, __root);
      }).toThrowError(
        'Elements\' "ref" property should be a function, or an object created by createRef(), but got [object] instead',
      );
    }
  });

  it('update', async function() {
    const cleanup = vi.fn();
    let ref1 = vi.fn(() => {
      return cleanup;
    });
    let ref2 = createRef();
    let ref3 = createRef();

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view ref={ref1} />
            <view ref={ref2} />
            <view ref={ref3} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
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
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // update ref
    const oldRef1 = ref1;
    const oldRef2 = ref2;
    const oldRef3 = ref3;
    oldRef1.mockClear();
    {
      globalEnvManager.switchToBackground();
      ref1 = vi.fn();
      ref2 = createRef();
      ref3 = null;
      render(<Comp />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":25,"snapshotPatch":[3,-2,0,20,3,-2,1,21,3,-2,2,null]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 25,
                "refPatch": "{"-2:0:":32,"-2:1:":33}",
              },
            ],
          ],
        ]
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 32,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 33,
          },
        }
      `);
      expect(oldRef1.mock.calls).toMatchInlineSnapshot(`[]`);
      expect(cleanup.mock.calls).toMatchInlineSnapshot(`
        [
          [],
        ]
      `);
      expect(oldRef2.current).toBeNull();
      expect(oldRef3.current).toBeNull();
    }
  });
});

describe('element ref in spread', () => {
  it('insert', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();
    let spread1 = {};
    const spread2 = { ref: ref2 };

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view {...spread1} />
            <view {...spread2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view />
            <view
              has-react-ref={true}
            />
          </view>
        </page>
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "jsReadyEventIdSwap": {},
                "refPatch": "{"-2:1:ref":38}",
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_13","values":[{},{"ref":"-2:1:ref"}]}]}",
              },
            ],
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
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
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 27,
                "refPatch": "{"-2:1:ref":38}",
              },
            ],
          ],
        ]
      `);
    }

    // ref
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 38,
          },
        }
      `);
    }

    // insert ref
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      spread1 = { ref: ref1 };
      render(<Comp />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":28,"snapshotPatch":[3,-2,0,{"ref":23}]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 28,
                "refPatch": "{"-2:0:ref":37}",
              },
            ],
          ],
        ]
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 37,
            },
          ],
        ]
      `);
    }
  });

  it('remove', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();
    let spread1 = { ref: ref1 };
    let spread2 = { ref: ref2 };

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            {this.props.show && <view {...spread1} />}
            <view {...spread2} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 43,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 42,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // ref
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      ref1.mockClear();
    }

    // remove ref
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      spread2 = {};
      render(<Comp show={false} />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":31,"snapshotPatch":[3,-2,0,{},2,-2,-3]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
    }

    // ref
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            null,
          ],
        ]
      `);
      expect(ref2.current).toBeNull();
    }
  });

  it('update', async function() {
    let ref1 = vi.fn();
    let ref2 = createRef();
    let ref3 = createRef();
    let spread1 = { ref: ref1 };
    let spread2 = { ref: ref2 };
    let spread3 = { ref: ref3 };

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            <view {...spread1} />
            <view {...spread2} />
            <view {...spread3} />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 46,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 47,
          },
        }
      `);
      expect(ref3).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 48,
          },
        }
      `);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      ref1.mockClear();
    }

    // update ref
    const oldRef1 = ref1;
    const oldRef2 = ref2;
    const oldRef3 = ref3;
    {
      globalEnvManager.switchToBackground();
      ref1 = vi.fn();
      ref2 = createRef();
      ref3 = null;
      spread1 = { ref: ref1 };
      spread2 = { ref: ref2 };
      spread3 = { ref: ref3 };
      render(<Comp />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":34,"snapshotPatch":[3,-2,0,{"ref":29},3,-2,1,{"ref":30},3,-2,2,{}]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxRef",
              {
                "commitTaskId": 34,
                "refPatch": "{"-2:0:ref":46,"-2:1:ref":47}",
              },
            ],
          ],
        ]
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "selectUniqueID": [Function],
              "uid": 46,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 47,
          },
        }
      `);
      expect(oldRef1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            null,
          ],
        ]
      `);
      expect(oldRef2.current).toBeNull();
      expect(oldRef3.current).toBeNull();
    }
  });
});

describe('element ref in list', () => {
  it('hydrate', async function() {
    const refs = [createRef(), createRef(), createRef()];
    const signs = [0, 0, 0];

    class ListItem extends Component {
      render() {
        return <view ref={this.props._ref}></view>;
      }
    }

    class Comp extends Component {
      render() {
        return (
          <list>
            {[0, 1, 2].map((index) => {
              return (
                <list-item item-key={index}>
                  <ListItem _ref={refs[index]}></ListItem>
                </list-item>
              );
            })}
          </list>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
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
                      "type": "__Card__:__snapshot_a94a8_test_19",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_19",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_19",
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
      render(<Comp />, __root);
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
                "refPatch": "{"-4:0:":52}",
              },
            ],
          ],
          [
            [
              "rLynxRef",
              {
                "commitTaskId": undefined,
                "refPatch": "{"-6:0:":54}",
              },
            ],
          ],
        ]
      `);
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[1]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refs[0]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 52,
          },
        }
      `);
      expect(refs[1]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 54,
          },
        }
      `);
      expect(refs[2].current).toBeNull();
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
                "refPatch": "{"-4:0:":null,"-8:0:":52}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refs[0].current).toBeNull();
      expect(refs[1]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 54,
          },
        }
      `);
      expect(refs[2]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 52,
          },
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
    const refs = [createRef(), createRef(), createRef()];
    const signs = [0, 0, 0];

    class ListItem extends Component {
      render() {
        return <view ref={this.props._ref}></view>;
      }
    }

    class Comp extends Component {
      render() {
        return (
          <list>
            {[0, 1, 2].map((index) => {
              return (
                <list-item item-key={index}>
                  <ListItem _ref={refs[index]}></ListItem>
                </list-item>
              );
            })}
          </list>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
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
                "refPatch": "{"-4:0:":58}",
              },
            ],
          ],
        ]
      `);
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refs[0]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 58,
          },
        }
      `);
      expect(refs[1].current).toBeNull();
      expect(refs[2].current).toBeNull();
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
                "refPatch": "{"-4:0:":null,"-6:0:":58}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refs[0].current).toBeNull();
      expect(refs[1]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 58,
          },
        }
      `);
      expect(refs[2].current).toBeNull();
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
                "refPatch": "{"-6:0:":null,"-8:0:":58}",
              },
            ],
          ],
        ]
      `);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(refs[0].current).toBeNull();
      expect(refs[1].current).toBeNull();
      expect(refs[2]).toMatchInlineSnapshot(`
        {
          "current": {
            "selectUniqueID": [Function],
            "uid": 58,
          },
        }
      `);
    }
  });

  it('when __FIRST_SCREEN_SYNC_TIMING__ is jsReady', async function() {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    const refs = [createRef(), createRef(), createRef()];
    const signs = [0, 0, 0];

    class ListItem extends Component {
      render() {
        return <view ref={this.props._ref}></view>;
      }
    }

    class Comp extends Component {
      render() {
        return (
          <list>
            {[0, 1, 2].map((index) => {
              return (
                <list-item item-key={index}>
                  <ListItem _ref={refs[index]}></ListItem>
                </list-item>
              );
            })}
          </list>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // list render item 1 & 2
    {
      signs[0] = elementTree.triggerComponentAtIndex(__root.childNodes[0].__elements[0], 0);
      expect(globalThis.__OnLifecycleEvent).toHaveBeenCalledTimes(1);

      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(delayedLifecycleEvents).toMatchInlineSnapshot(`
        [
          [
            "rLynxRef",
            {
              "commitTaskId": undefined,
              "refPatch": "{"-4:0:":62}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(<Comp />, __root);
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
      expect(globalThis.__OnLifecycleEvent).toHaveBeenCalledTimes(1);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "jsReadyEventIdSwap": {},
                "refPatch": "{}",
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_24","children":[{"id":-3,"type":"__Card__:__snapshot_a94a8_test_25","values":[{"item-key":0}],"children":[{"id":-4,"type":"__Card__:__snapshot_a94a8_test_23","values":["-4:0:"]}]},{"id":-5,"type":"__Card__:__snapshot_a94a8_test_25","values":[{"item-key":1}],"children":[{"id":-6,"type":"__Card__:__snapshot_a94a8_test_23","values":["-6:0:"]}]},{"id":-7,"type":"__Card__:__snapshot_a94a8_test_25","values":[{"item-key":2}],"children":[{"id":-8,"type":"__Card__:__snapshot_a94a8_test_23","values":["-8:0:"]}]}]}]}",
              },
            ],
          ],
        ]
      `);
    }

    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();

      expect(refs[0].current).toMatchInlineSnapshot(`
        {
          "selectUniqueID": [Function],
          "uid": 62,
        }
      `);
    }
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });
});
