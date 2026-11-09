/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render, options, Component, createElement, process } from 'preact';
import { beforeAll, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';

import { setupDocument } from '../../../src/document';
import { setupPage, snapshotInstanceManager } from '../../../src/snapshot';
import { initProfileHook } from '../../../src/snapshot/debug/profileHooks';
import { useState } from '../../../src/index';
import {
  COMMIT,
  COMPONENT,
  DIFF,
  DIFF2,
  DIFFED,
  HOOKS,
  LIST,
  RENDER,
  VNODE,
} from '../../../src/shared/render-constants';

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

  test.each(['main', 'background'])('preserves profiling callback contracts on %s', target => {
    vi.stubGlobal('__MAIN_THREAD__', target === 'main');
    vi.stubGlobal('__BACKGROUND__', target === 'background');
    const previousHooks = {
      [COMMIT]: options[COMMIT],
      [DIFF]: options[DIFF],
      [DIFF2]: options[DIFF2],
      [DIFFED]: options[DIFFED],
      [RENDER]: options[RENDER],
    };
    const previousSetState = Component.prototype.setState;
    onTestFinished(() => {
      Object.assign(options, previousHooks);
      Component.prototype.setState = previousSetState;
      vi.unstubAllGlobals();
    });
    const events = [];
    const performance = lynx.performance;
    const oldSetState = Component.prototype.setState = vi.fn(function(state, callback) {
      expect(this).toBe(instance);
      expect(state).toBe(nextState);
      expect(callback).toBe(setStateCallback);
      events.push('old setState');
    });
    const oldDiff = options[DIFF] = vi.fn(() => events.push('old before diff'));
    const oldCommit = options[COMMIT] = vi.fn(() => {
      expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::commit', {});
      events.push('old commit');
    });
    const oldDiff2 = options[DIFF2] = vi.fn(() => {
      expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::diff::Example', {});
      events.push('old diff');
    });
    const oldDiffed = options[DIFFED] = vi.fn(() => {
      expect(performance.profileEnd).toHaveBeenCalledTimes(2);
      events.push('old diffed');
    });
    const oldRender = options[RENDER] = vi.fn(() => {
      expect(instance.render).not.toBe(originalRender);
      events.push('old render');
    });
    initProfileHook();

    const failure = new Error('render failed');
    class Example extends Component {
      render() {
        expect(this).toBe(instance);
        expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::render::Example');
        events.push('render');
        throw failure;
      }
    }
    const vnode = createElement(Example, {});
    const oldVNode = createElement(Example, {});
    const instance = vnode[COMPONENT] = new Example({});
    const originalRender = instance.render;

    const nextState = { count: 1 };
    const setStateCallback = () => {};
    const commitQueue = [instance];
    instance.setState(nextState, setStateCallback);
    options[DIFF]?.(vnode);
    options[DIFF2]?.(vnode, oldVNode);
    options[RENDER]?.(vnode);
    expect(() => instance.render()).toThrow(failure);
    expect(instance.render).toBe(originalRender);
    options[DIFFED]?.(vnode);

    if (target === 'background') {
      options[COMMIT]?.(vnode, commitQueue);
      expect(oldCommit.mock.calls).toEqual([[vnode, commitQueue]]);
      expect(oldCommit.mock.contexts).toEqual([undefined]);
      expect(performance.profileEnd).toHaveBeenCalledTimes(3);
      expect(oldDiff.mock.contexts).toEqual([undefined]);
    }
    expect(oldSetState.mock.calls).toEqual([[nextState, setStateCallback]]);
    expect(oldSetState.mock.contexts).toEqual([instance]);
    expect(oldDiff.mock.calls).toEqual([[vnode]]);
    expect(oldDiff2.mock.calls).toEqual([[vnode, oldVNode]]);
    expect(oldRender.mock.calls).toEqual([[vnode]]);
    expect(oldDiffed.mock.calls).toEqual([[vnode]]);
    expect(oldDiff2.mock.contexts).toEqual([undefined]);
    expect(oldRender.mock.contexts).toEqual([undefined]);
    expect(oldDiffed.mock.contexts).toEqual([undefined]);
    expect(events).toEqual([
      'old setState',
      'old before diff',
      'old diff',
      'old render',
      'render',
      'old diffed',
      ...(target === 'background' ? ['old commit'] : []),
    ]);
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
              "currentValue": "{"type":"object","entries":[["count",0]]}",
              "next state keys": "["count"]",
              "nextValue": "{"type":"object","entries":[["count",1]]}",
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
              "currentValue": "{"type":"object","entries":[["count",0],["unchanged",{"type":"string","length":9,"preview":"unchanged"}]]}",
              "hookIdx": "1",
              "next state keys": "["count","unchanged","newKey"]",
              "nextValue": "{"type":"object","entries":[["count",1],["unchanged",{"type":"string","length":9,"preview":"unchanged"}],["newKey",{"type":"string","length":8,"preview":"newValue"}]]}",
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
              "currentValue": "{"type":"object","entries":[["count",0],["circularKey",{"type":"object"}]]}",
              "hookIdx": "2",
              "next state keys": "["count","circularKey"]",
              "nextValue": "{"type":"object","entries":[["count",1],["circularKey",{"type":"object"}]]}",
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
              "currentValue": "{"type":"function"}",
              "hookIdx": "0",
              "next state keys": "[]",
              "nextValue": "{"type":"function"}",
            },
            "flowId": 666,
          },
        ],
      ]
    `);
  });

  test('reports field addition and removal against each pending Hook value', () => {
    let update;
    function App() {
      const [, setState] = useState({ removed: 1, stable: NaN, signedZero: 0 });
      update = setState;
      return <view />;
    }

    render(<App />, scratch);
    update({ stable: NaN, signedZero: -0, added: undefined });
    update({ stable: NaN, signedZero: -0, removed: 2 });

    const [first, second] = lynx.performance.profileMark.mock.calls.map(([, { args }]) => args);
    expect(JSON.parse(first['changed (shallow diff) state keys'])).toEqual(['removed', 'signedZero', 'added']);
    expect(JSON.parse(second['changed (shallow diff) state keys'])).toEqual(['added', 'removed']);
    expect(second.currentValue).toBe(first.nextValue);
  });

  test('bounds string and record previews without calling getters or toJSON', () => {
    let update;
    function App() {
      const [, setState] = useState({});
      update = setState;
      return <view />;
    }
    render(<App />, scratch);

    const value = 'x'.repeat(1000);
    update(value);
    const getter = vi.fn(() => {
      throw new Error('getter ran');
    });
    const toJSON = vi.fn(() => {
      throw new Error('toJSON ran');
    });
    const record = { toJSON };
    Object.defineProperty(record, 'getter', { enumerable: true, get: getter });
    Object.assign(record, Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`key${i}`, value])));
    update(record);
    const keys = Object.keys(record).filter(key => key !== 'getter').reverse();
    update(Object.fromEntries(keys.map(key => [key, record[key]])));

    const array = Array.from({ length: 1000 });
    array[0] = array;
    update(array);

    const [stringArgs, recordArgs, reorderedArgs, arrayArgs] = lynx.performance.profileMark.mock.calls.map(
      ([, { args }]) => args,
    );
    expect(stringArgs['next state keys']).toBe('[]');
    expect(JSON.parse(stringArgs.nextValue)).toEqual({ type: 'string', length: 1000, preview: 'x'.repeat(80) + '…' });
    expect(JSON.parse(recordArgs['next state keys'])).toHaveLength(16);
    expect(JSON.parse(recordArgs['changed (shallow diff) state keys'])).toHaveLength(16);
    expect(recordArgs['state keys truncated']).toBe('true');
    expect(JSON.parse(recordArgs.nextValue).entries).toContainEqual(['getter', { type: 'accessor' }]);
    expect(JSON.parse(reorderedArgs['changed (shallow diff) state keys'])).toEqual(['getter']);
    expect(arrayArgs['next state keys']).toBe('[]');
    expect(JSON.parse(arrayArgs.nextValue)).toEqual({ type: 'array', length: 1000 });
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });

  test('continues a Hook update when state inspection or trace emission throws', () => {
    let update;
    let rendered;
    function App() {
      const [value, setValue] = useState(0);
      rendered = value;
      update = setValue;
      return <view />;
    }
    render(<App />, scratch);

    update(1n);
    expect(JSON.parse(lynx.performance.profileMark.mock.lastCall[1].args.nextValue)).toEqual({ type: 'bigint' });
    process();
    expect(rendered).toBe(1n);

    const opaque = new Proxy({}, {
      ownKeys() {
        throw new Error('inspection failed');
      },
    });
    update(opaque);
    process();
    expect(rendered).toBe(opaque);

    // Replace the opaque value before testing the sink so state inspection succeeds.
    update(2n);
    process();
    const sinkError = vi.fn(() => {
      throw new Error('trace sink failed');
    });
    lynx.performance.profileMark.mockImplementationOnce(sinkError);
    update(3n);
    process();
    expect(sinkError).toHaveBeenCalledTimes(1);
    expect(rendered).toBe(3n);
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
