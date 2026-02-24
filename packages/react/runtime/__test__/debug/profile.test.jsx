/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render, options, Component } from 'preact';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { setupDocument } from '../../src/document';
import { setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { initProfileHook } from '../../src/debug/profile';
import { useState } from '../../src/index';
import { COMPONENT, DIFF, DIFF2, DIFFED, HOOKS, LIST, RENDER, VNODE } from '../../src/renderToOpcodes/constants';

describe('profile', () => {
  let scratch;
  beforeAll(() => {
    setupDocument();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    snapshotInstanceManager.clear();
    scratch = document.createElement('root');
    lynx.performance.profileMark.mockClear();
  });

  test('original options hooks should be called', async () => {
    const noop = vi.fn();

    const oldDiff = options[DIFF];
    const oldDiff2 = options[DIFF2];
    const oldRender = options[RENDER];
    const oldDiffed = options[DIFFED];

    options[DIFF] = noop;
    options[DIFF2] = noop;
    options[RENDER] = noop;
    options[DIFFED] = noop;

    render(
      null,
      scratch,
    );

    expect(noop).toBeCalledTimes(4);

    options[DIFF] = oldDiff;
    options[DIFF2] = oldDiff2;
    options[RENDER] = oldRender;
    options[DIFFED] = oldDiffed;
  });

  test('diff and render should be profiled', async () => {
    class ClassComponent {
      render() {
        return null;
      }

      static displayName = 'Clazz';
    }

    function Bar() {
      return <ClassComponent />;
    }
    Bar.displayName = 'Baz';

    function Foo() {
      return <Bar />;
    }

    render(
      <Foo />,
      scratch,
    );

    // // ReactLynx::render::
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Foo`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::render::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Baz`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::render::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Clazz`);

    // // ReactLynx::diff::
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Foo`, {});
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::diff::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Baz`, {});
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::diff::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Clazz`, {});
  });

  test('should trace setState updates in class components', async () => {
    const profileMarkSpy = lynx.performance.profileMark;
    let triggerUpdate;
    class ClassComponent extends Component {
      state = {
        count: 0,
      };

      render() {
        triggerUpdate = () => this.setState({ count: this.state.count + 1 });
        return (
          <view>
            <text>{this.state.count}</text>
            <view
              onClick={triggerUpdate}
              id='btn'
            />
          </view>
        );
      }
    }

    render(
      <ClassComponent />,
      scratch,
    );
    triggerUpdate();

    expect(profileMarkSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "ReactLynx::setState",
          {
            "args": {
              "changed (shallow diff) state keys": "["count"]",
              "componentName": "ClassComponent",
              "current state keys": "["count"]",
              "currentValue": "{"count":0}",
              "next state keys": "["count"]",
              "nextValue": "{"count":1}",
            },
            "flowId": 666,
          },
        ],
      ]
    `);
  });

  test('should trace useState updates in functional components', async () => {
    const profileMarkSpy = lynx.performance.profileMark;

    let triggerUpdatePrimitive;
    let triggerUpdateObject;
    let triggerUpdateObjectCircular;
    function App() {
      const [count, setCount] = useState(0);
      const [obj, setObj] = useState({ count: 0, unchanged: 'unchanged' });
      let tmp = { count: 0 };
      tmp.circularKey = tmp;
      let [circularObj, setCircularObj] = useState(tmp);
      triggerUpdatePrimitive = () => setCount(count + 1);
      triggerUpdateObject = () => setObj({ count: obj.count + 1, unchanged: obj.unchanged, newKey: 'newValue' });
      triggerUpdateObjectCircular = () =>
        setCircularObj({
          ...circularObj,
          count: circularObj.count + 1,
        });

      return (
        <view>
          <text>{count}</text>
          <view
            bindtap={triggerUpdatePrimitive}
            id='btn-primitive'
          />
          <view
            bindtap={triggerUpdateObject}
            id='btn-object'
          />
          <view
            bindtap={triggerUpdateObjectCircular}
            id='btn-object-circular'
          />
        </view>
      );
    }

    render(<App />, scratch);
    triggerUpdatePrimitive();
    triggerUpdateObject();
    triggerUpdateObjectCircular();

    expect(profileMarkSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "ReactLynx::hooks::setState",
          {
            "args": {
              "changed (shallow diff) state keys": "[]",
              "componentName": "App",
              "current state keys": "[]",
              "currentValue": "0",
              "hookIdx": "0",
              "next state keys": "[]",
              "nextValue": "1",
            },
            "flowId": 666,
          },
        ],
        [
          "ReactLynx::hooks::setState",
          {
            "args": {
              "changed (shallow diff) state keys": "["count","newKey"]",
              "componentName": "App",
              "current state keys": "["count","unchanged"]",
              "currentValue": "{"count":0,"unchanged":"unchanged"}",
              "hookIdx": "1",
              "next state keys": "["count","unchanged","newKey"]",
              "nextValue": "{"count":1,"unchanged":"unchanged","newKey":"newValue"}",
            },
            "flowId": 666,
          },
        ],
        [
          "ReactLynx::hooks::setState",
          {
            "args": {
              "changed (shallow diff) state keys": "["count"]",
              "componentName": "App",
              "current state keys": "["count","circularKey"]",
              "currentValue": "{"count":0,"circularKey":"[Unserializable: Circular]"}",
              "hookIdx": "2",
              "next state keys": "["count","circularKey"]",
              "nextValue": "{"count":1,"circularKey":{"count":0,"circularKey":"[Unserializable: Circular]"}}",
            },
            "flowId": 666,
          },
        ],
      ]
    `);
  });

  test('should handle function values in useState', async () => {
    const profileMarkSpy = lynx.performance.profileMark;

    const funcA = () => 'A';
    const funcB = () => 'B';

    let updateFunc;
    function App() {
      const [func, setFunc] = useState(() => funcA);

      updateFunc = () => setFunc(() => funcB);

      return <text>{func()}</text>;
    }

    render(<App />, scratch);
    updateFunc();

    expect(profileMarkSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "ReactLynx::hooks::setState",
          {
            "args": {
              "changed (shallow diff) state keys": "[]",
              "componentName": "App",
              "current state keys": "[]",
              "currentValue": ""() => \\"A\\""",
              "hookIdx": "0",
              "next state keys": "[]",
              "nextValue": ""() => \\"B\\""",
            },
            "flowId": 666,
          },
        ],
      ]
    `);
  });

  test('should handle missing component instance', async () => {
    let capturedComponent;

    const profileWrapper = options.diffed;
    options.diffed = (vnode) => {
      if (vnode[COMPONENT] && typeof vnode.type === 'function' && vnode.type.name === 'App') {
        capturedComponent = vnode[COMPONENT];
      }
      profileWrapper?.(vnode);
    };

    try {
      let updateMissing;
      function App() {
        const [val, setVal] = useState(0);
        updateMissing = () => setVal(1);
        return <text>{val}</text>;
      }
      render(<App />, scratch);
      expect(capturedComponent).toBeDefined();

      if (capturedComponent && capturedComponent[HOOKS] && capturedComponent[HOOKS][LIST]) {
        capturedComponent[HOOKS][LIST][0][COMPONENT] = undefined;
      } else {
        throw new Error('Failed to access hook state for sabotage');
      }

      expect(() => {
        updateMissing();
      }).toThrow();
    } finally {
      options.diffed = profileWrapper;
    }
  });

  test('should handle unknown component name', async () => {
    const profileMarkSpy = lynx.performance.profileMark;
    let capturedComponent;

    const profileWrapper = options.diffed;
    options.diffed = (vnode) => {
      if (vnode.__c && typeof vnode.type === 'function' && vnode.type.name === 'App') {
        capturedComponent = vnode.__c;
      }
      profileWrapper?.(vnode);
    };

    let updateUnknown;
    function App() {
      const [val, setVal] = useState(0);
      updateUnknown = () => setVal(1);
      return <text>{val}</text>;
    }

    render(<App />, scratch);
    expect(capturedComponent).toBeDefined();

    if (capturedComponent && capturedComponent[VNODE]) {
      // Sabotage: set type to something not a function
      capturedComponent[VNODE].type = {};
    } else {
      throw new Error('Failed to access vnode for sabotage');
    }
    updateUnknown();

    expect(profileMarkSpy).toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.objectContaining({
        args: expect.objectContaining({
          componentName: 'Unknown',
        }),
      }),
    );
  });
});
