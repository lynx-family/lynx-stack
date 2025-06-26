import '@testing-library/jest-dom';
import { describe, test, vi, expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';
import { render, waitSchedule } from '..';
import { act } from 'preact/test-utils';

describe('alog', () => {
  test('should log', async () => {
    vi.spyOn(lynxTestingEnv.mainThread.console, 'alog');
    vi.spyOn(lynxTestingEnv.backgroundThread.console, 'alog');

    let _setCount;
    class App extends Component {
      render() {
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
          "[MainThread Component Render] name: Fragment, snapshotId: undefined, __id: undefined",
        ],
        [
          "[MainThread Component Render] name: App, snapshotId: undefined, __id: undefined",
        ],
        [
          "[MainThread Component Render] name: ClassComponent, snapshotId: undefined, __id: undefined",
        ],
        [
          "[MainThread Component Render] name: FunctionComponent, snapshotId: undefined, __id: undefined",
        ],
      ]
    `);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: Fragment, snapshotId: undefined, __id: undefined",
        ],
        [
          "[BackgroundThread Component Render] name: App, snapshotId: undefined, __id: undefined",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, snapshotId: undefined, __id: undefined",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, snapshotId: undefined, __id: undefined",
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
          "[BackgroundThread Component Render] name: App, snapshotId: __Card__:__snapshot_426db_test_1, __id: -2",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, snapshotId: undefined, __id: undefined",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, snapshotId: undefined, __id: undefined",
        ],
      ]
    `);
  });
});
