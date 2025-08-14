import '@testing-library/jest-dom';
import { describe, test, vi, expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';
import { render } from '..';
import { act } from 'preact/test-utils';

describe('alog', () => {
  test('should log', async () => {
    vi.spyOn(lynxTestingEnv.mainThread.console, 'alog');
    vi.spyOn(lynxTestingEnv.backgroundThread.console, 'alog');

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

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[MainThread Component Render] name: ClassComponent",
        ],
        [
          "[MainThread Component Render] name: FunctionComponent",
        ],
        [
          "[MainThread Component Render] name: App",
        ],
      ]
    `);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __Card__:__snapshot_426db_test_2, __id: 6",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __Card__:__snapshot_426db_test_3, __id: 7",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __Card__:__snapshot_426db_test_1, __id: 2",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __Card__:__snapshot_426db_test_1, __id: 2",
        ],
      ]
    `);

    lynxTestingEnv.mainThread.console.alog.mockClear();
    lynxTestingEnv.backgroundThread.console.alog.mockClear();

    act(() => {
      _setCount(0);
    });

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`[]`);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`[]`);

    lynxTestingEnv.mainThread.console.alog.mockClear();
    lynxTestingEnv.backgroundThread.console.alog.mockClear();

    act(() => {
      _setCount(1);
    });

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`[]`);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __Card__:__snapshot_426db_test_2, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __Card__:__snapshot_426db_test_3, __id: -6",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __Card__:__snapshot_426db_test_1, __id: -2",
        ],
      ]
    `);
  });
});
