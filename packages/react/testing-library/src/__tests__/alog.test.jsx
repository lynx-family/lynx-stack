import '@testing-library/jest-dom';
import { describe, test, vi, expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';
import { render } from '..';
import { act } from 'preact/test-utils';

describe('alog', () => {
  test('should log', async () => {
    let mainThreadALogCalls = [];
    let backgroundThreadALogCalls = [];
    console.alog = (...args) => {
      if (__MAIN_THREAD__) {
        mainThreadALogCalls.push(args);
      } else {
        backgroundThreadALogCalls.push(args);
      }
    };

    let _setCount;
    function App() {
      const [count, setCount] = useState(0);
      _setCount = setCount;
      return (
        <view>
          <text bindtap={() => setCount(count + 1)}>count: {count}</text>
          <ClassComponent />
          <FunctionComponent />
        </view>
      );
    }
    class ClassComponent extends Component {
      render() {
        return <view>Class Component</view>;
      }
    }
    function FunctionComponent() {
      return <view>Function Component</view>;
    }

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(mainThreadALogCalls).toMatchInlineSnapshot(`
      [
        [
          "[MainThread Component Render] name: ClassComponent, uniqID: __Card__:__snapshot_895c1_test_2, __id: -6",
        ],
        [
          "[MainThread Component Render] name: FunctionComponent, uniqID: __Card__:__snapshot_895c1_test_3, __id: -7",
        ],
        [
          "[MainThread Component Render] name: App, uniqID: __Card__:__snapshot_895c1_test_1, __id: -2",
        ],
        [
          "[MainThread Component Render] name: Fragment, uniqID: __Card__:__snapshot_895c1_test_1, __id: -2",
        ],
      ]
    `);
    expect(backgroundThreadALogCalls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __Card__:__snapshot_895c1_test_2, __id: 6",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __Card__:__snapshot_895c1_test_3, __id: 7",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __Card__:__snapshot_895c1_test_1, __id: 2",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __Card__:__snapshot_895c1_test_1, __id: 2",
        ],
      ]
    `);

    mainThreadALogCalls = [];
    backgroundThreadALogCalls = [];

    act(() => {
      _setCount(0);
    });

    mainThreadALogCalls = [];
    backgroundThreadALogCalls = [];

    act(() => {
      _setCount(1);
    });

    expect(mainThreadALogCalls).toMatchInlineSnapshot(`[]`);
    expect(backgroundThreadALogCalls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __Card__:__snapshot_895c1_test_2, __id: -6",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __Card__:__snapshot_895c1_test_3, __id: -7",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __Card__:__snapshot_895c1_test_1, __id: -2",
        ],
      ]
    `);
  });
});
