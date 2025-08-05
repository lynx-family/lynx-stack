import { render } from 'preact';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementTree } from '../utils/nativeMethod';
import { BackgroundSnapshotInstance } from '../../src/backgroundSnapshot';
import { setupBackgroundDocument } from '../../src/document';
import { backgroundSnapshotInstanceManager, setupPage, SnapshotInstance } from '../../src/snapshot';
import { backgroundSnapshotInstanceToJSON } from '../utils/debug';
import { useState } from 'preact/compat';
import { useInitData } from '../../src/lynx-api';
import { EventEmitter } from 'node:events';
import { globalEnvManager } from '../utils/envManager';

describe('initData', () => {
  /** @type {SnapshotInstance} */
  let scratch;
  const ee = new EventEmitter();

  beforeAll(() => {
    setupBackgroundDocument();
    setupPage(__CreatePage('0', 0));

    BackgroundSnapshotInstance.prototype.toJSON = backgroundSnapshotInstanceToJSON;

    globalEnvManager.switchToBackground();

    const lynx = {
      ...globalThis.lynx,
      getJSModule: (moduleName) => {
        if (moduleName === 'GlobalEventEmitter') {
          return ee;
        }
      },
      __initData: {},
    };
    vi.stubGlobal('lynx', lynx);
  });

  afterAll(() => {
    delete BackgroundSnapshotInstance.prototype.toJSON;
  });

  beforeEach(() => {
    scratch = document.createElement('root');
  });

  afterEach(() => {
    render(null, scratch);
    elementTree.clear();
    backgroundSnapshotInstanceManager.clear();
  });

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
      'key1': 'value1',
    };
    lynx.getJSModule('GlobalEventEmitter').emit('onDataChanged');
    _setD(2);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ee.listeners('onDataChanged').length).toMatchInlineSnapshot(`1`);
    expect(_initData).toMatchInlineSnapshot(`
      {
        "key1": "value1",
      }
    `);
    render(null, scratch);
    expect(ee.listeners('onDataChanged').length).toMatchInlineSnapshot(`0`);
  });
});
