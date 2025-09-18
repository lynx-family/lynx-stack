/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RefProxy, runDelayedUiOps, shouldDelayUiOps } from '../../src/lifecycle/ref/delay';

import { Component, createRef, useState } from '../../src/index';
import { clearCommitTaskId, replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { __pendingListUpdates } from '../../src/pendingListUpdates';
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
  clearCommitTaskId();
});

afterEach(() => {
  vi.restoreAllMocks();

  globalEnvManager.resetEnv();
  elementTree.clear();
  __pendingListUpdates.clear();
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
              react-ref--2-0={1}
            />
            <view
              react-ref--2-1={1}
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
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_3","values":["react-ref--2-0","react-ref--2-1"]}]}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);

      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            2,
            1,
          ],
          "task": undefined,
        }
      `);
    }
  });

  it('should trigger ref when insert node', async function() {
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
        `"{"patchList":[{"id":3,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_4",2,4,2,[1,1],1,-1,2,null]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              2,
              1,
            ],
            "task": undefined,
          },
        }
      `);
    }
  });

  it('should trigger ref when remove node', async function() {
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
        `"{"patchList":[{"id":3,"snapshotPatch":[2,-1,-2]}]}"`,
      );
    }

    // ref patch
    {
      globalEnvManager.switchToBackground();
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

  it('should trigger ref when remove node with cleanup function', async function() {
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
        `"{"patchList":[{"id":3,"snapshotPatch":[2,-1,-2]}]}"`,
      );
    }

    // ref patch
    {
      globalEnvManager.switchToBackground();
      expect(ref1).not.toBeCalled();
      expect(cleanup.mock.calls).toMatchInlineSnapshot(`
        [
          [],
        ]
      `);
    }
  });

  it('should trigger ref when ref and unref deeply', async () => {
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
    }

    ref1.forEach(ref => {
      expect(ref).toHaveBeenCalledWith(expect.objectContaining({
        refAttr: expect.any(Array),
      }));
    });
    expect(ref2).toHaveBeenCalledWith(expect.objectContaining({
      refAttr: expect.any(Array),
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

    // ref check
    {
      globalEnvManager.switchToBackground();
      ref1.forEach(ref => expect(ref).toHaveBeenCalledWith(null));
      expect(ref2).toHaveBeenCalledWith(null);
    }
  });

  it('should trigger ref when ref is null in the first screen', async function() {
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
              react-ref--2-0={1}
            />
            <view
              react-ref--2-1={1}
            />
            <view
              react-ref--2-2={1}
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
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_9","values":["react-ref--2-0","react-ref--2-1","react-ref--2-2"]}]}",
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

      expect(ref1.current).toBeNull();
      expect(ref2.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            2,
            1,
          ],
          "task": undefined,
        }
      `);
      expect(ref3.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                2,
                2,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[3,-2,0,null],"id":2}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      // Keep "-2:0" exists even if it is set to null. This is for the first screen.
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              react-ref--2-0={1}
            />
            <view
              react-ref--2-1={1}
            />
            <view
              react-ref--2-2={1}
            />
          </view>
        </page>
      `);
    }
  });

  it('should throw error when ref type is wrong', async function() {
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

  it('should trigger ref when ref object is updated', async function() {
    const cleanup = vi.fn();
    let ref1 = vi.fn(() => {
      return cleanup;
    });
    let ref2 = createRef();
    let ref3 = createRef();

    class Comp extends Component {
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
        `"{"patchList":[{"id":3,"snapshotPatch":[3,-2,2,null]}]}"`,
      );
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                -2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              -2,
              1,
            ],
            "task": undefined,
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

  it('should work when using ref along with other attributes', async function() {
    const ref = createRef();
    const attr1 = 1;

    class Comp extends Component {
      render() {
        return <view ref={ref} attr1={attr1} />;
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
      expect(ref.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            2,
            0,
          ],
          "task": undefined,
        }
      `);
    }
  });

  // NOT working for now
  it.skip('should work when using error boundary with ref', async function() {
    const ref = vi.fn(() => {
      throw new Error('error in ref');
    });
    const errorHandler = vi.fn();

    class Comp extends Component {
      state = { hasError: false };

      componentDidCatch(error, info) {
        errorHandler(error, info);
        this.setState({ hasError: true });
      }

      render() {
        if (this.state.hasError) {
          return <view>Error occurred</view>;
        }
        return <view ref={ref}></view>;
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
      expect(ref.current).toMatchInlineSnapshot(`undefined`);

      expect(errorHandler).toHaveBeenCalledTimes(1);
    }
  });

  it('should not trigger ref when ref function is not updated', async function() {
    let ref1 = vi.fn();
    let show = true;

    class Comp extends Component {
      render() {
        return (
          <view>
            {show && <view ref={ref1} />}
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

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                3,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      ref1.mockClear();
      render(<Comp />, __root);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      ref1.mockClear();
      show = false;
      render(<Comp />, __root);
    }
    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            null,
          ],
        ]
      `);
    }
  });

  it('should trigger ref when element not exists in the first screen', async function() {
    const ref1 = vi.fn();

    class Comp extends Component {
      x = 'x';
      render() {
        return (
          <view>
            {this.props.switch && (
              <view>
                <view ref={ref1} />
              </view>
            )}
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp switch={false} />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view />
        </page>
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls[0]).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_17"}]}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp switch={true} />, __root);
      lynx.getNativeApp().callLepusMethod.mockClear();

      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                3,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      ref1.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_18",3,4,3,[1],1,-2,3,null],"id":2}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      // Keep "-2:0" exists even if it is set to null. This is for the first screen.
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <view
                react-ref-3-0={1}
              />
            </view>
          </view>
        </page>
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
    }
  });
});

describe('element ref in spread', () => {
  it('should trigger ref when insert ref into spread', async function() {
    const ref1 = vi.fn();
    const ref2 = createRef();
    let spread1 = {};
    const spread2 = { ref: ref2 };
    const spread3 = { ref: undefined };

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
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view />
            <view
              react-ref--2-1={1}
            />
            <view />
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
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_19","values":[{},{"ref":"react-ref--2-1"},{}]}]}",
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
    }

    // ref
    {
      expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              2,
              1,
            ],
            "task": undefined,
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
        `"{"patchList":[{"id":3,"snapshotPatch":[3,-2,0,{"ref":1}]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view
              react-ref--2-0={1}
            />
            <view
              react-ref--2-1={1}
            />
            <view />
          </view>
        </page>
      `);
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                -2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
    }
  });

  it('should trigger ref when remove ref from spread', async function() {
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
            RefProxy {
              "refAttr": [
                3,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              2,
              0,
            ],
            "task": undefined,
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
        `"{"patchList":[{"id":3,"snapshotPatch":[3,-2,0,{},2,-2,-3]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
    }

    // ref
    {
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

  it('should trigger ref when update ref in spread', async function() {
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
            RefProxy {
              "refAttr": [
                2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              2,
              1,
            ],
            "task": undefined,
          },
        }
      `);
      expect(ref3).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              2,
              2,
            ],
            "task": undefined,
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
        `"{"patchList":[{"id":3,"snapshotPatch":[3,-2,2,{}]}]}"`,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // ref
    {
      globalEnvManager.switchToBackground();
      expect(ref1.mock.calls).toMatchInlineSnapshot(`
        [
          [
            RefProxy {
              "refAttr": [
                -2,
                0,
              ],
              "task": undefined,
            },
          ],
        ]
      `);
      expect(ref2).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              -2,
              1,
            ],
            "task": undefined,
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
      ref1.mockClear();
    }

    // update ref
    {
      ref3 = createRef();
      spread3 = { ref: ref3 };
      render(<Comp />, __root);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":4,"snapshotPatch":[3,-2,2,{"ref":1}]}]}"`,
      );
      expect(ref1.mock.calls).toMatchInlineSnapshot(`[]`);
      expect(ref3.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            -2,
            2,
          ],
          "task": undefined,
        }
      `);
    }
  });
});

describe('element ref in list', () => {
  it('should trigger ref in list', async function() {
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
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_25",
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

      expect(refs[0]).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              4,
              0,
            ],
            "task": undefined,
          },
        }
      `);
      expect(refs[1]).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              6,
              0,
            ],
            "task": undefined,
          },
        }
      `);
      expect(refs[2]).toMatchInlineSnapshot(`
        {
          "current": RefProxy {
            "refAttr": [
              8,
              0,
            ],
            "task": undefined,
          },
        }
      `);
    }

    // list render item 1 & 2
    {
      globalEnvManager.switchToMainThread();
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
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
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_25",
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
                react-ref--4-0={1}
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                react-ref--6-0={1}
              />
            </list-item>
          </list>
        </page>
      `);
    }

    // list enqueue item 1 & render item 3
    {
      globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef.mockClear();
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
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 1,
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_25",
                    },
                    {
                      "item-key": 2,
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_25",
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
                react-ref--8-0={1}
              />
            </list-item>
            <list-item
              item-key={1}
            >
              <view
                react-ref--6-0={1}
              />
            </list-item>
          </list>
        </page>
      `);
    }
  });
});

describe('ui operations', () => {
  it('should delay until hydration finished', async function() {
    const ref1 = vi.fn((ref) => {
      ref.invoke({
        method: 'boundingClientRect',
      }).exec();
    });

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

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`[]`);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[react-ref--2-0]",
            "invoke",
            [
              {
                "method": "boundingClientRect",
              },
            ],
          ],
        ]
      `);
      lynx.createSelectorQuery().constructor.execLog.mockClear();
    }
  });

  it('should support more usages of ref 1', async function() {
    const ref1 = vi.fn((ref) => {
      ref.setNativeProps({
        'background-color': 'blue',
      }).exec();
      ref.path(vi.fn()).exec();
    });

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
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[react-ref--2-0]",
            "setNativeProps",
            [
              {
                "background-color": "blue",
              },
            ],
          ],
          [
            "[react-ref--2-0]",
            "path",
            [
              [MockFunction spy],
            ],
          ],
        ]
      `);
      lynx.createSelectorQuery().constructor.execLog.mockClear();
    }
  });

  it('should support more usages of ref 2', async function() {
    const ref1 = vi.fn((ref) => {
      const fields = ref.fields({
        id: true,
      });
      fields.exec();
      fields.exec();
    });

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
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[react-ref--2-0]",
            "fields",
            [
              {
                "id": true,
              },
            ],
          ],
          [
            "[react-ref--2-0]",
            "fields",
            [
              {
                "id": true,
              },
            ],
          ],
        ]
      `);
      lynx.createSelectorQuery().constructor.execLog.mockClear();
    }
  });

  it('should forward animation operations via ref proxy', () => {
    const selectorQueryConstructor = lynx.createSelectorQuery().constructor;
    selectorQueryConstructor.execLog.mockClear();
    shouldDelayUiOps.value = true;

    const animations = [{ duration: 350, name: 'fade' }];
    const animationIds = ['anim-1', 'anim-2'];

    const ref = new RefProxy([-2, 0]);

    ref.animate(animations).exec();
    ref.playAnimation(animationIds).exec();
    ref.pauseAnimation('anim-2').exec();
    ref.cancelAnimation(animationIds).exec();

    expect(selectorQueryConstructor.execLog.mock.calls).toMatchInlineSnapshot(`[]`);

    runDelayedUiOps();

    expect(selectorQueryConstructor.execLog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[react-ref--2-0]",
          "animate",
          [
            [
              {
                "duration": 350,
                "name": "fade",
              },
            ],
          ],
        ],
        [
          "[react-ref--2-0]",
          "playAnimation",
          [
            [
              "anim-1",
              "anim-2",
            ],
          ],
        ],
        [
          "[react-ref--2-0]",
          "pauseAnimation",
          [
            "anim-2",
          ],
        ],
        [
          "[react-ref--2-0]",
          "cancelAnimation",
          [
            [
              "anim-1",
              "anim-2",
            ],
          ],
        ],
      ]
    `);

    selectorQueryConstructor.execLog.mockClear();
    shouldDelayUiOps.value = true;
  });

  it('should not delay after hydration', async function() {
    const ref1 = createRef();

    function Comp() {
      return (
        <view>
          <view ref={ref1} />
        </view>
      );
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
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`[]`);

      lynx.createSelectorQuery().constructor.execLog.mockClear();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // call ref
    {
      ref1.current.invoke({
        method: 'boundingClientRect',
      }).exec();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[react-ref--2-0]",
            "invoke",
            [
              {
                "method": "boundingClientRect",
              },
            ],
          ],
        ]
      `);
    }
  });

  it('should not delay after hydration', async function() {
    const ref1 = vi.fn((ref) => {
      ref.invoke({
        method: 'boundingClientRect',
      }).exec();
    });

    let show = false;
    function Child() {
      return <view ref={ref1} />;
    }

    function Comp() {
      return (
        <view>
          {show ? <Child /> : null}
        </view>
      );
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
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalThis.__OnLifecycleEvent.mockClear();
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`[]`);

      lynx.createSelectorQuery().constructor.execLog.mockClear();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // set show
    {
      show = true;
      render(<Comp />, __root);

      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":3,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_30",3,4,3,[1],1,-2,3,null]}]}"`,
      );
      expect(lynx.createSelectorQuery().constructor.execLog.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "[react-ref-3-0]",
            "invoke",
            [
              {
                "method": "boundingClientRect",
              },
            ],
          ],
        ]
      `);
    }
  });
});

describe('runDelayedUiOps helper', () => {
  it('should reset shouldDelayUiOps when no tasks queued', () => {
    // flush any queued tasks from previous tests
    shouldDelayUiOps.value = false;
    runDelayedUiOps();

    shouldDelayUiOps.value = true;
    runDelayedUiOps();
    expect(shouldDelayUiOps.value).toBe(false);
  });
});
