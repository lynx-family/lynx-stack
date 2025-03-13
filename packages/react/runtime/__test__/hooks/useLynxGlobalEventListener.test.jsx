/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { EventEmitter } from 'node:events';

import { render } from 'preact';
import { useState } from 'preact/compat';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackgroundSnapshotInstance } from '../../src/backgroundSnapshot';
import { setupBackgroundDocument } from '../../src/document';
import { replaceRequestAnimationFrame } from '../../src/lifecycle/patch/patchUpdate';
import { useLynxGlobalEventListener } from '../../src/lynx-api';
import { SnapshotInstance, backgroundSnapshotInstanceManager, setupPage } from '../../src/snapshot';
import { backgroundSnapshotInstanceToJSON } from '../utils/debug.js';
import { elementTree } from '../utils/nativeMethod';

describe('useLynxGlobalEventListener', () => {
  /** @type {SnapshotInstance} */
  let scratch;
  const ee = new EventEmitter();

  beforeAll(() => {
    setupBackgroundDocument();
    replaceRequestAnimationFrame();
    setupPage(__CreatePage('0', 0));

    BackgroundSnapshotInstance.prototype.toJSON = backgroundSnapshotInstanceToJSON;

    const lynx = {
      getJSModule: (moduleName) => {
        if (moduleName === 'GlobalEventEmitter') {
          return ee;
        }
      },
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

  it('should not leak listeners when rerender and unmount & should capture newest state', async function() {
    let _setD;
    let fn = vi.fn();
    function App() {
      const [d, setD] = useState(0);
      _setD = setD;
      useLynxGlobalEventListener('eventName', () => {
        fn(d);
      });
      return <view d={d} />;
    }

    render(<App />, scratch);
    _setD(1);
    render(<App />, scratch);
    lynx.getJSModule('GlobalEventEmitter').emit('eventName');
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          1,
        ],
      ]
    `);

    _setD(2);
    render(<App />, scratch);
    _setD(3);
    render(<App />, scratch);
    _setD(4);
    render(<App />, scratch);
    _setD(5);
    render(<App />, scratch);

    lynx.getJSModule('GlobalEventEmitter').emit('eventName');
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          1,
        ],
        [
          5,
        ],
      ]
    `);
    expect(ee.listeners('eventName').length).toMatchInlineSnapshot(`1`);

    render(null, scratch);
    expect(ee.listeners('eventName').length).toMatchInlineSnapshot(`0`);
  });

  it('should not remove & add if eventName & listener is not changed', async function() {
    const fakeEE = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    vi.stubGlobal('lynx', {
      getJSModule: (moduleName) => {
        if (moduleName === 'GlobalEventEmitter') {
          return fakeEE;
        }
      },
    });

    let _setD;
    let fn = vi.fn();
    function App() {
      const [d, setD] = useState(0);
      _setD = setD;
      useLynxGlobalEventListener(`eventName`, fn);
      return <view d={d} />;
    }

    render(<App />, scratch);
    _setD(1);
    render(<App />, scratch);
    _setD(2);
    render(<App />, scratch);
    _setD(3);
    render(<App />, scratch);
    _setD(4);
    render(<App />, scratch);
    _setD(5);
    render(<App />, scratch);

    expect(lynx.getJSModule('GlobalEventEmitter').addListener.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "eventName",
          [MockFunction spy],
        ],
      ]
    `);
    expect(lynx.getJSModule('GlobalEventEmitter').removeListener.mock.calls).toMatchInlineSnapshot(`[]`);

    // should remove & add if listener is changed
    const oldFn = fn;
    fn = vi.fn();
    render(<App />, scratch);
    expect(lynx.getJSModule('GlobalEventEmitter').addListener.mock.calls[0][1]).toBe(oldFn);
    expect(lynx.getJSModule('GlobalEventEmitter').addListener.mock.calls[1][1]).toBe(fn);
    expect(lynx.getJSModule('GlobalEventEmitter').removeListener.mock.calls[0][1]).toBe(oldFn);
  });
});
