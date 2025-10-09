import { Component, options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEffect, useLayoutEffect, useState } from '../src/index';
import { globalEnvManager } from './utils/envManager';
import { waitSchedule } from './utils/nativeMethod';
import { globalCommitTaskMap, replaceCommitHook } from '../src/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch, initGlobalSnapshotPatch } from '../src/lifecycle/patch/snapshotPatch';
import { LifecycleConstant } from '../src/lifecycleConstant';
import { CATCH_ERROR } from '../src/renderToOpcodes/constants';
import { __root } from '../src/root';
import { backgroundSnapshotInstanceManager, setupPage } from '../src/snapshot';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  globalCommitTaskMap.clear();
  globalEnvManager.resetEnv();
  deinitGlobalSnapshotPatch();
  vi.restoreAllMocks();
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
    globalEnvManager.switchToBackground();

    render(<Comp />, __root);

    await Promise.resolve().then(() => {});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanUp).toHaveBeenCalledTimes(0);

    render(<Comp />, __root);

    await Promise.resolve().then(() => {});

    expect(callback).toHaveBeenCalledTimes(2);
    expect(cleanUp).toHaveBeenCalledTimes(1);
  });

  it('throw', async function() {
    globalEnvManager.switchToBackground();

    const catchError = options[CATCH_ERROR];
    options[CATCH_ERROR] = vi.fn();

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
    expect(callback).toHaveBeenCalledTimes(2);

    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(3);
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
    expect(callback).toHaveBeenCalledTimes(1);
    expect(x_).toEqual(1);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":6,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_3",2,0,0,null,3,0,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
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
    expect(callback).toHaveBeenCalledTimes(1);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(3);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    expect(mtCallback[1]).toMatchInlineSnapshot(`
      {
        "data": "{"patchList":[{"id":9,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_4",2,0,0,null,3,0,3,3,0,1,1,2,3,null,1,1,2,null]}]}",
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
    const didMount = vi.fn();

    class Comp extends Component {
      x = 1;
      componentWillUnmount() {
        willUnmount();
        x_ = this.x;
      }

      componentDidMount() {
        didMount();
      }

      render() {
        return <text>{1}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    await waitSchedule();
    expect(didMount).toHaveBeenCalledTimes(1);
    expect(willUnmount).toHaveBeenCalledTimes(0);

    render(null, __root);
    await waitSchedule();
    expect(didMount).toHaveBeenCalledTimes(1);
    expect(willUnmount).toHaveBeenCalledTimes(1);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(2);
    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();

    expect(didMount).toHaveBeenCalledTimes(1);
    expect(willUnmount).toHaveBeenCalledTimes(1);

    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();

    expect(didMount).toHaveBeenCalledTimes(1);
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
    expect(willUnmount).toHaveBeenCalledTimes(4);

    mtCallback = mtCallbacks.shift();
    mtCallback[2]();
    await waitSchedule();
    expect(willUnmount).toHaveBeenCalledTimes(4);
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
    expect(willUnmount).toHaveBeenCalledTimes(0);

    showB = false;
    render(<Comp />, __root);
    Object.assign(__root, __root);
    await waitSchedule();

    expect(willUnmount).toHaveBeenCalledTimes(1);

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
        `"{"patchList":[{"id":24,"snapshotPatch":[3,-2,1,"abcd",3,-2,2,{"str":"efgh"}]}]}"`,
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
        `"{"patchList":[{"id":27,"snapshotPatch":[0,"__Card__:__snapshot_a94a8_test_15",2,0,4,2,[false,{"str":"str"}],1,-1,2,null]}]}"`,
      );
    }
  });
});

describe('componentDidUpdate', () => {
  it('basic', async function() {
    globalEnvManager.switchToBackground();

    const callback = vi.fn();
    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;
    let _setState = vi.fn();

    class Comp extends Component {
      state = {
        show: false,
      };

      constructor(props) {
        super(props);
        _setState = this.setState.bind(this);
      }

      componentDidUpdate() {
        callback();
      }

      render() {
        return <text>{this.state.show ? '1' : '2'}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(1);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback.length).toEqual(3);
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    mtCallback[2]();

    await waitSchedule();
    expect(callback).toHaveBeenCalledTimes(0);

    _setState({ show: true });
    await waitSchedule();
    mtCallback = mtCallbacks.shift();
    expect(mtCallback.length).toEqual(3);
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    mtCallback[2]();
    expect(callback).toHaveBeenCalledTimes(1);

    _setState({ show: false });
    await waitSchedule();
    mtCallback = mtCallbacks.shift();
    expect(mtCallback.length).toEqual(3);
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    mtCallback[2]();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('multiple updates', async function() {
    globalEnvManager.switchToBackground();

    const callback = vi.fn();
    let mtCallbacks = lynx.getNativeApp().callLepusMethod.mock.calls;
    let _setState = vi.fn();

    class Comp extends Component {
      state = {
        count: 0,
      };

      constructor(props) {
        super(props);
        _setState = this.setState.bind(this);
      }

      componentDidUpdate() {
        callback(this.state.count);
      }

      render() {
        return <text>{this.state.count}</text>;
      }
    }

    initGlobalSnapshotPatch();

    render(<Comp />, __root);
    expect(callback).toHaveBeenCalledTimes(0);

    let mtCallback;
    expect(mtCallbacks.length).toEqual(1);
    mtCallback = mtCallbacks.shift();
    expect(mtCallback.length).toEqual(3);
    expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
    mtCallback[2]();
    expect(callback).toHaveBeenCalledTimes(0);

    _setState(({ count }) => ({ count: count + 1 }));
    await waitSchedule();
    _setState(({ count }) => ({ count: count + 1 }));
    await waitSchedule();

    expect(mtCallbacks.length).toEqual(2);
    expect(callback).toHaveBeenCalledTimes(2);

    mtCallbacks.forEach(mtCallback => {
      expect(mtCallback.length).toEqual(3);
      expect(mtCallback[0]).toEqual(LifecycleConstant.patchUpdate);
      mtCallback[2]();
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).nthCalledWith(1, 1);
    expect(callback).nthCalledWith(2, 2);
  });
});
