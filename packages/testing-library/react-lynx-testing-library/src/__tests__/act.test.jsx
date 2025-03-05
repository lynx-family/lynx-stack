import '@lynx-js/lynx-dom-jest-matchers';
import { vi } from 'vitest';
import { test } from 'vitest';
import { render, waitSchedule, fireEvent } from '..';
import { Component, createRef, useEffect, useState } from '@lynx-js/react';
import { expect } from 'vitest';
import { __globalSnapshotPatch } from '@lynx-js/react/runtime/lib/snapshotPatch.js';

test('render calls useEffect immediately', async () => {
  const cb = vi.fn();
  function Comp() {
    useEffect(() => {
      cb(`__LEPUS__: ${__LEPUS__}`);
    });
    return <view />;
  }
  const { container } = render(<Comp />);
  expect(container).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <view />
    </page>
  `);

  // ensure that the effect is called in background thread
  await waitSchedule();

  expect(cb).toBeCalledTimes(1);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__LEPUS__: false",
      ],
    ]
  `);
});

test('findByTestId returns the element', async () => {
  const ref = createRef();
  class Comp extends Component {
    render() {
      return (
        <view ref={ref} data-testid='foo'>
          <text>Hello world!</text>
        </view>
      );
    }
  }
  const { container, findByTestId } = render(<Comp />);

  expect(container).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <view
        dataset={
          {
            "testid": "foo",
          }
        }
        has-react-ref={true}
      >
        <text>
          <raw-text
            text="Hello world!"
          />
        </text>
      </view>
    </page>
  `);
  expect(await findByTestId('foo')).toMatchInlineSnapshot(`
    <view
      dataset={
        {
          "testid": "foo",
        }
      }
      has-react-ref={true}
    >
      <text>
        <raw-text
          text="Hello world!"
        />
      </text>
    </view>
  `);
  expect(ref.current).toMatchInlineSnapshot(`
    NodesRef {
      "_nodeSelectToken": {
        "identifier": "1",
        "type": 2,
      },
      "_selectorQuery": {},
    }
  `);
});

test('fireEvent triggers useEffect calls', async () => {
  expect(__globalSnapshotPatch).toMatchInlineSnapshot(`undefined`);
  // mock lynx.getNativeApp().callLepusMethod
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
  expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);
  const cb = vi.fn();
  const onTap = vi.fn();
  function Counter() {
    const [count, setCount] = useState(0);
    useEffect(() => cb(count));
    return (
      <text
        bindtap={(...args) => {
          onTap(...args);
          setCount(count + 1);
        }}
      >
        {count}
      </text>
    );
  }
  const { container } = render(<Counter />);
  expect(container).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text
        event={
          {
            "bindEvent:tap": "2:0:",
          }
        }
      >
        <raw-text
          text={0}
        />
      </text>
    </page>
  `);
  const buttonNode = container.children[0];
  expect(buttonNode).toMatchInlineSnapshot(`
    <text
      event={
        {
          "bindEvent:tap": "2:0:",
        }
      }
    >
      <raw-text
        text={0}
      />
    </text>
  `);
  expect(callLepusMethodCalls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[0,"__Card__:__snapshot_268b9_test_3",2,0,null,3,4,3,[0],1,2,3,null,4,2,[1],1,-1,2,null]}",
          "patchOptions": {
            "commitTaskId": 8,
            "isHydration": true,
            "pipelineOptions": {
              "needTimestamps": true,
              "pipelineID": "pipelineID",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
    ]
  `);
  fireEvent.tap(buttonNode);
  // ensure that the effect is called in background thread
  await waitSchedule();
  expect(callLepusMethodCalls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[0,"__Card__:__snapshot_268b9_test_3",2,0,null,3,4,3,[0],1,2,3,null,4,2,[1],1,-1,2,null]}",
          "patchOptions": {
            "commitTaskId": 8,
            "isHydration": true,
            "pipelineOptions": {
              "needTimestamps": true,
              "pipelineID": "pipelineID",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[3,3,0,1]}",
          "patchOptions": {
            "commitTaskId": 9,
            "pipelineOptions": {
              "needTimestamps": true,
              "pipelineID": "pipelineID",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
    ]
  `);

  expect(buttonNode).toHaveTextContent('1');
  expect(cb).toHaveBeenCalledTimes(2);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        0,
      ],
      [
        1,
      ],
    ]
  `);
  expect(onTap.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          "eventName": "tap",
        },
      ],
    ]
  `);

  vi.clearAllMocks();
});
