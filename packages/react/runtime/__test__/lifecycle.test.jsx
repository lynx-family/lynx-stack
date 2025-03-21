import { Component, options } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEffect, useLayoutEffect, useState } from '../src/index';
import { globalEnvManager } from './utils/envManager';
import { initDelayUnmount } from '../src/lifecycle/delayUnmount';
import { globalCommitTaskMap, replaceCommitHook, replaceRequestAnimationFrame } from '../src/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch, initGlobalSnapshotPatch } from '../src/lifecycle/patch/snapshotPatch';
import { renderBackground as render } from '../src/lifecycle/render';
import { LifecycleConstant } from '../src/lifecycleConstant';
import { CATCH_ERROR } from '../src/renderToOpcodes/constants';
import { __root } from '../src/root';
import { backgroundSnapshotInstanceManager, setupPage } from '../src/snapshot';
import { elementTree, waitSchedule } from './utils/nativeMethod';

beforeAll(() => {
  options.debounceRendering = Promise.prototype.then.bind(Promise.resolve());
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
  initDelayUnmount();
  replaceRequestAnimationFrame();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  globalCommitTaskMap.clear();
  globalEnvManager.resetEnv();
  deinitGlobalSnapshotPatch();
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('useEffect', () => {
  it('basic', async function() {
    const cleanUp = vi.fn();
    const callback = vi.fn().mockImplementation(() => cleanUp);

    function Comp() {
      const [val, setVal] = useState(1);
      useEffect(callback);
      return <text>{val}</text>;
    }

    initGlobalSnapshotPatch();
    let mtCallbacks = lynx.getNativeApp().callLepusMethod;
    globalEnvManager.switchToBackground();

    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    expect(mtCallbacks.mock.calls.length).toBe(1);
    mtCallbacks.mock.calls[0][2]();
    lynx.getNativeApp().callLepusMethod.mockClear();
    expect(callback).toHaveBeenCalledTimes(0);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    expect(mtCallbacks.mock.calls.length).toBe(1);
    mtCallbacks.mock.calls[0][2]();
    lynx.getNativeApp().callLepusMethod.mockClear();

    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(cleanUp).toHaveBeenCalledTimes(1);
  });

  it('should call after main thread returns', async function() {
    globalEnvManager.switchToBackground();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    const cleanUp = vi.fn();
    const callback = vi.fn().mockImplementation(() => cleanUp);

    function Comp() {
      const [val, setVal] = useState(1);
      useLayoutEffect(callback);
      return <text>{val}</text>;
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    render(<Comp />, __root);
    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    let mtCallback;
    // expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":3,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_2",2,0,null,3,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    expect(mtCallbacks.length).toEqual(2);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":4}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(cleanUp).toHaveBeenCalledTimes(1);

    expect(mtCallbacks.length).toEqual(1);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":5}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(3);
    expect(cleanUp).toHaveBeenCalledTimes(2);
  });

  it('change before hydration', async function() {
    let setVal_;

    const cleanUp = vi.fn();
    const callback = vi.fn(() => {
      return cleanUp;
    });

    function Comp() {
      const [val, setVal] = useState(1);
      setVal_ = setVal;
      useLayoutEffect(callback);
      return <text>{val}</text>;
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

    // background state change
    {
      setVal_(300);
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // background state change
    {
      setVal_(400);
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[3,-3,0,400],"id":9}]}"`,
      );
      globalThis.__OnLifecycleEvent.mockClear();

      await waitSchedule();
      expect(callback).toHaveBeenCalledTimes(0);
      expect(cleanUp).toHaveBeenCalledTimes(0);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();

      await waitSchedule();
      expect(callback).toHaveBeenCalledTimes(3);
      expect(cleanUp).toHaveBeenCalledTimes(2);
    }
  });

  it('cleanup function should delay when unmounts', async function() {
    const cleanUp = vi.fn();
    const callback = vi.fn(() => {
      return cleanUp;
    });

    function A() {
      useLayoutEffect(callback);
    }

    function Comp(props) {
      return props.show && <A />;
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
      globalThis.__OnLifecycleEvent.mockClear();

      await waitSchedule();
      expect(callback).toHaveBeenCalledTimes(0);
      expect(cleanUp).toHaveBeenCalledTimes(0);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      rLynxChange[2]();
      await waitSchedule();
    }

    // background unmount
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      render(<Comp show={false} />, __root);
      expect(callback).toHaveBeenCalledTimes(0);
      expect(cleanUp).toHaveBeenCalledTimes(0);
    }

    {
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(2);
      let rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      rLynxChange[2]();
      await waitSchedule();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(cleanUp).toHaveBeenCalledTimes(0);

      rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[1];
      rLynxChange[2]();
      await waitSchedule();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(cleanUp).toHaveBeenCalledTimes(1);
    }
  });

  it('throw', async function() {
    globalEnvManager.switchToBackground();

    const catchError = options[CATCH_ERROR];
    options[CATCH_ERROR] = vi.fn();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    const callback = vi.fn().mockImplementation(() => {
      throw '???';
    });

    function Comp() {
      const [val, setVal] = useState(1);
      useLayoutEffect(callback, []);
      return <text>{val}</text>;
    }

    initGlobalSnapshotPatch();
    render(<Comp />, __root);
    render(<Comp />, __root);
    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":14,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_4",2,0,null,3,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(options[CATCH_ERROR]).toHaveBeenCalledWith('???', expect.anything());
    options[CATCH_ERROR] = catchError;
  });
});

describe('componentDidMount', () => {
  it('basic', async function() {
    globalEnvManager.switchToBackground();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    let x_ = 0;
    const callback = vi.fn();

    class Comp extends Component {
      x = 1;
      componentDidMount() {
        callback();
        x_ = this.x;
      }

      render() {
        return <text>{1}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    render(<Comp />, __root);
    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":17,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_5",2,0,null,3,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(x_).toEqual(1);
  });

  it('throw', async function() {
    globalEnvManager.switchToBackground();

    const catchError = options[CATCH_ERROR];
    options[CATCH_ERROR] = vi.fn();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    const callback = vi.fn().mockImplementation(() => {
      throw '???';
    });

    class Comp extends Component {
      componentDidMount() {
        callback();
      }

      render() {
        return <text>{1}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    render(<Comp />, __root);
    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":20,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_6",2,0,null,3,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
        "patchOptions": {
          "reloadVersion": 0,
        },
      }
    `);
    mtCallback[2]();
    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(options[CATCH_ERROR]).toHaveBeenCalledWith('???', expect.anything());
    options[CATCH_ERROR] = catchError;
  });
});

describe('componentWillUnmount', () => {
  it('basic', async function() {
    globalEnvManager.switchToBackground();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    let x_ = 0;
    const willUnmount = vi.fn();
    const didupdate = vi.fn();

    class Comp extends Component {
      x = 1;
      componentWillUnmount() {
        willUnmount();
        x_ = this.x;
      }

      componentDidMount() {
        didupdate();
      }

      render() {
        return <text>{1}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    await waitSchedule();
    expect(didupdate).toHaveBeenCalledTimes(0);
    expect(willUnmount).toHaveBeenCalledTimes(0);

    render(null, __root);
    await waitSchedule();
    expect(didupdate).toHaveBeenCalledTimes(0);
    expect(willUnmount).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(2);
    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();

    expect(didupdate).toHaveBeenCalledTimes(1);
    expect(willUnmount).toHaveBeenCalledTimes(0);

    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();

    expect(didupdate).toHaveBeenCalledTimes(1);
    expect(willUnmount).toHaveBeenCalledTimes(1);
    expect(x_).toEqual(1);
  });

  it('throw', async function() {
    globalEnvManager.switchToBackground();

    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;

    let showB = true;
    let showA = true;
    const willUnmount = vi.fn();
    const didCatch = vi.fn();
    const willUnmountBase = vi.fn();

    class BaseComponent extends Component {
      componentWillUnmount() {
        willUnmountBase();
      }
    }

    class A extends BaseComponent {
      componentWillUnmount() {
        super.componentWillUnmount();
        willUnmount();
        throw this.props.msg;
      }

      render() {
        return <text>{1}</text>;
      }
    }

    class B extends Component {
      componentWillUnmount() {
        willUnmount();
      }

      render() {
        return <view>{showA && <A msg={this.props.msg}></A>}</view>;
      }
    }

    class Comp extends Component {
      x = 1;

      componentDidCatch(e) {
        didCatch(e);
        this.setState({});
      }

      render() {
        return (
          <view>
            {showB && (
              <view>
                <B msg={'error1'}></B>
                <B msg={'error2'}></B>
              </view>
            )}
          </view>
        );
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    showA = false;
    render(<Comp />, __root);
    showB = false;
    render(<Comp />, __root);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();
    expect(willUnmount).toHaveBeenCalledTimes(0);

    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();
    expect(willUnmount).toHaveBeenCalledTimes(2);
    expect(willUnmountBase).toHaveBeenCalledTimes(2);
    expect(didCatch).toHaveBeenCalledTimes(2);
    expect(didCatch).toHaveBeenNthCalledWith(1, 'error1');
    expect(didCatch).toHaveBeenNthCalledWith(2, 'error2');

    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();
    expect(willUnmount).toHaveBeenCalledTimes(4);
    expect(willUnmountBase).toHaveBeenCalledTimes(2);
    expect(didCatch).toHaveBeenCalledTimes(2);
  });

  it('page destroy', async function(ctx) {
    globalEnvManager.switchToBackground();

    const willUnmount = vi.fn();
    let showB = true;

    class B extends Component {
      componentWillUnmount() {
        willUnmount();
      }

      render() {
        return <view></view>;
      }
    }

    class Comp extends Component {
      componentWillUnmount() {
        willUnmount();
      }

      render() {
        return (
          <view>
            {showB && <B></B>}
          </view>
        );
      }
    }

    render(<Comp />, __root);
    await waitSchedule();

    showB = false;
    render(<Comp />, __root);
    Object.assign(__root, __root);
    await waitSchedule();

    expect(willUnmount).toHaveBeenCalledTimes(0);

    lynxCoreInject.tt.callDestroyLifetimeFun();
    expect(willUnmount).toHaveBeenCalledTimes(2);
  });
});

describe('BackgroundSnapshotInstance remove', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('basic', async function() {
    globalEnvManager.switchToBackground();

    let mtCallbacks = [];
    lynx.getNativeApp().callLepusMethod.mockImplementation((name, data, cb) => {
      mtCallbacks.push([name, data, cb]);
    });

    let setShow_;

    function Comp() {
      const [show, setShow] = useState(1);
      setShow_ = setShow;
      return (
        <view>
          {show && <text>1</text>}
        </view>
      );
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    await Promise.resolve().then(() => {});
    vi.runAllTimers();
    expect([...backgroundSnapshotInstanceManager.values.keys()])
      .toMatchInlineSnapshot(`
        [
          1,
          2,
          3,
        ]
      `);

    mtCallbacks = [];
    setShow_(false);
    await Promise.resolve().then(() => {});
    vi.runAllTimers();

    mtCallbacks[0][2]();
    expect([...backgroundSnapshotInstanceManager.values.keys()])
      .toMatchInlineSnapshot(`
        [
          1,
          2,
          3,
        ]
      `);
    await Promise.resolve().then(() => {});
    vi.runAllTimers();
    expect([...backgroundSnapshotInstanceManager.values.keys()])
      .toMatchInlineSnapshot(`
        [
          1,
          2,
        ]
      `);
  });
});

describe('useState', () => {
  it('basic', async function() {
    let setStrValue_;
    let setObjValue_;
    function Comp() {
      const [boolValue, setBoolValue] = useState(false);
      const [strValue, setStrValue] = useState('str');
      const [objValue, setObjValue] = useState({ str: 'str' });

      setStrValue_ = setStrValue;
      setObjValue_ = setObjValue;

      return (
        <view>
          <text attr={boolValue}></text>
          <text attr={strValue}></text>
          <text attr={objValue}></text>
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
      rLynxChange[2]();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
    }

    // update
    {
      globalEnvManager.switchToBackground();
      setStrValue_('abcd');
      setObjValue_({ str: 'efgh' });
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":36,"snapshotPatch":[3,-2,1,"abcd",3,-2,2,{"str":"efgh"}]}]}"`,
      );
    }
  });

  it('basic 2', async function() {
    let setShow_;
    function Comp(props) {
      const [show, setShow] = useState(false);
      const [boolValue, setBoolValue] = useState(false);
      const [strValue, setStrValue] = useState('str');
      const [objValue, setObjValue] = useState({ str: 'str' });

      setShow_ = setShow;

      return show && (
        <view>
          <text attr={boolValue}></text>
          <text attr={objValue}></text>
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
      rLynxChange[2]();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await waitSchedule();
    }

    // update
    {
      globalEnvManager.switchToBackground();
      setShow_(true);
      await waitSchedule();
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"id":39,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_17",2,4,2,[false,{"str":"str"}],1,-1,2,null]}]}"`,
      );
    }
  });

  it('should batch multiple updates', async function() {
    let _setCount;
    let _setCount2;

    const Child1 = () => {
      const [count, setCount] = useState(0);
      _setCount = setCount;
      return (
        <view>
          <text text={count} />
        </view>
      );
    };

    const Child2 = () => {
      const [count, setCount] = useState(0);
      _setCount2 = setCount;
      return (
        <view>
          <text text={count} />
        </view>
      );
    };

    const Comp = () => {
      return (
        <view>
          <Child1 />
          <Child2 />
        </view>
      );
    };

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
      _setCount(1);
      _setCount2(2);
      await waitSchedule();

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(
        `
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":42,"snapshotPatch":[3,-3,0,1]},{"id":43,"snapshotPatch":[3,-4,0,2]}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `,
      );
    }

    {
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
              <text
                text={1}
              />
            </view>
            <view>
              <text
                text={2}
              />
            </view>
          </view>
        </page>
      `);
    }
  });
});
