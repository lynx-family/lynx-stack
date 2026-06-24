import { Component, render } from 'preact';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementTree, waitSchedule } from '../utils/nativeMethod';
import { setupBackgroundDocument } from '../../../src/document';
import {
  setupPage,
  SnapshotInstance,
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
} from '../../../src/snapshot';
import { backgroundSnapshotInstanceToJSON } from '../utils/debug';
import { useState } from 'preact/compat';
import { useInitData, withInitDataInState } from '../../../src/lynx-api';
import { NativeUpdateDataType } from '../../../src/snapshot/lifecycle/constant';
import { globalEnvManager } from '../utils/envManager';

/** @type {SnapshotInstance} */
let scratch;

beforeAll(() => {
  setupBackgroundDocument();
  setupPage(__CreatePage('0', 0));

  BackgroundSnapshotInstance.prototype.toJSON = backgroundSnapshotInstanceToJSON;

  globalEnvManager.switchToBackground();
});

afterAll(() => {
  delete BackgroundSnapshotInstance.prototype.toJSON;
});

beforeEach(() => {
  scratch = document.createElement('root');
  lynx.__initData = {};
});

afterEach(() => {
  render(null, scratch);
  elementTree.clear();
  backgroundSnapshotInstanceManager.clear();
});

describe('initData', () => {
  it('should get latest initData', async function() {
    let _setD, _initData;
    function App() {
      const initData = useInitData();
      const [d, setD] = useState(0);
      _setD = setD;
      _initData = initData;
      return <view d={d} />;
    }
    render(<App />, scratch);
    _setD(1);
    lynx.__initData = {
      key1: 'value1',
    };
    lynx.getJSModule('GlobalEventEmitter').emit('onDataChanged');
    _setD(2);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(lynx.getJSModule('GlobalEventEmitter').listeners['onDataChanged'].length).toMatchInlineSnapshot(`1`);
    expect(_initData).toMatchInlineSnapshot(`
      {
        "key1": "value1",
      }
    `);
    render(null, scratch);
    expect(lynx.getJSModule('GlobalEventEmitter').listeners['onDataChanged'].length).toMatchInlineSnapshot(`0`);
  });
});

describe('withInitDataInState', () => {
  let app;
  class App extends Component {
    constructor() {
      super();
      app = this;
    }
    render() {
      const initData = useInitData();
      return <view d={initData} />;
    }
  }
  const _App = withInitDataInState(App);
  it('should inject `__initData` to `state` of component', async () => {
    render(<_App />, scratch);
    const tt = lynxCoreInject.tt;
    expect(app.state).toMatchInlineSnapshot(`{}`);
    tt.updateCardData({
      key2: 'value2',
    });
    expect(lynx.__initData).toMatchInlineSnapshot(`
      {
        "key2": "value2",
      }
    `);
    // setState is called with the initData
    expect(app.state).toMatchInlineSnapshot(`{}`);
    expect(app.__s).toMatchInlineSnapshot(`
      {
        "key2": "value2",
      }
    `);
    await waitSchedule();
    // state is updated
    expect(app.state).toMatchInlineSnapshot(`
      {
        "key2": "value2",
      }
    `);
  });
  it('updateCardData twice', async () => {
    const _App = withInitDataInState(App);
    render(<_App />, scratch);
    const tt = lynxCoreInject.tt;
    expect(app.state).toMatchInlineSnapshot(`{}`);
    tt.updateCardData({
      key3: 'value3',
    });
    await waitSchedule();
    // state is updated
    expect(app.state).toMatchInlineSnapshot(`
      {
        "key3": "value3",
      }
    `);
    app.setState({
      key3: null,
    });
    await waitSchedule();
    expect(app.state).toMatchInlineSnapshot(`
      {
        "key3": null,
      }
    `);
    tt.updateCardData({});
    await waitSchedule();
    expect(app.state).not.eq(lynx.__initData);
    // Should keep the state if no new data
    expect(app.state).toMatchInlineSnapshot(`
      {
        "key3": null,
      }
    `);
    expect(lynx.__initData).toMatchInlineSnapshot(`
      {
        "key3": "value3",
      }
    `);
  });

  it('resets initData and strips timing flag before emitting data changes', () => {
    const tt = lynxCoreInject.tt;
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const listener = vi.fn();
    const originalReportError = lynx.reportError;
    lynx.reportError = vi.fn();
    lynx.__initData = {
      stale: true,
      key4: 'old',
    };
    emitter.addListener('onDataChanged', listener);

    try {
      tt.updateCardData(
        {
          key4: 'reset',
          __lynx_timing_flag: '__lynx_timing_actual_fmp',
        },
        { type: NativeUpdateDataType.RESET },
      );

      expect(lynx.__initData).toEqual({
        key4: 'reset',
      });
      expect(listener).toHaveBeenCalledWith({
        key4: 'reset',
      });
      // this case validates timing-flag stripping; the timing-flag error is reported first
      // (other dev errors, e.g. the withInitDataInState reset diagnostic, may follow
      // depending on suite state, so don't assert the exact call count here)
      expect(lynx.reportError).toHaveBeenCalled();
      expect(String(lynx.reportError.mock.calls[0]?.[0]?.message ?? '')).toBe(
        'Received unsupported updateData with `__lynx_timing_flag` (value "__lynx_timing_actual_fmp"), the timing flag is ignored',
      );
    } finally {
      emitter.removeListener('onDataChanged', listener);
      lynx.reportError = originalReportError;
    }
  });
});
