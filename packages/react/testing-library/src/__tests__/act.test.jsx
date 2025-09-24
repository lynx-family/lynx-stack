import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { test } from 'vitest';
import { render, fireEvent } from '..';
import { useEffect, useState } from 'preact/hooks';
import { createRef } from 'preact';
import { Component } from 'preact';
import { expect } from 'vitest';
import { __globalSnapshotPatch } from '../../../runtime/lib/lifecycle/patch/snapshotPatch.js';
import { snapshotInstanceManager } from '../../../runtime/lib/snapshot.js';

test('render calls useEffect immediately', async () => {
  const cb = vi.fn();
  function Comp() {
    useEffect(() => {
      cb(`__MAIN_THREAD__: ${__MAIN_THREAD__}`);
    });
    return <view />;
  }
  {
    const { container, unmount } = render(<Comp />);
    expect(container).toMatchInlineSnapshot(`
    <page>
      <view />
    </page>
  `);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__MAIN_THREAD__: false",
      ],
    ]
  `);

    unmount();
    cb.mockClear();
  }

  {
    const { container, unmount } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: false,
    });
    expect(container).toMatchInlineSnapshot(`<page />`);

    expect(cb).toBeCalledTimes(0);
    expect(cb.mock.calls).toMatchInlineSnapshot(`[]`);

    unmount();
    cb.mockClear();
  }

  {
    const { container, unmount } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view />
      </page>
    `);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "__MAIN_THREAD__: false",
        ],
      ]
    `);

    unmount();
    cb.mockClear();
  }
});

test('render calls componentDidMount immediately', async () => {
  const cb = vi.fn();
  class Comp extends Component {
    componentDidMount() {
      cb(`__MAIN_THREAD__: ${__MAIN_THREAD__}`);
    }
    render() {
      return <view />;
    }
  }
  const { container } = render(<Comp />);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view />
    </page>
  `);
  expect(cb).toBeCalledTimes(1);
  expect(cb.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "__MAIN_THREAD__: false",
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
    <page>
      <view
        data-testid="foo"
        react-ref-2-0="1"
      >
        <text>
          Hello world!
        </text>
      </view>
    </page>
  `);
  expect(await findByTestId('foo')).toMatchInlineSnapshot(`
    <view
      data-testid="foo"
      react-ref-2-0="1"
    >
      <text>
        Hello world!
      </text>
    </view>
  `);
  expect(ref.current).toMatchInlineSnapshot(`
    RefProxy {
      "refAttr": [
        2,
        0,
      ],
      "task": undefined,
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
  expect(snapshotInstanceManager.values).toMatchInlineSnapshot(`
    Map {
      -1 => {
        "children": undefined,
        "extraProps": undefined,
        "id": -1,
        "type": "root",
        "values": undefined,
      },
    }
  `);
  const { container } = render(<Counter />);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <text>
        0
      </text>
    </page>
  `);
  const buttonNode = container.firstChild;
  expect(buttonNode).toMatchInlineSnapshot(`
    <text>
      0
    </text>
  `);
  expect(callLepusMethodCalls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"snapshotPatch":[0,"__Card__:__snapshot_e8d0a_test_4",2,4,2,[1],0,null,3,4,3,[0],1,2,3,null,1,-1,2,null],"id":2}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
    ]
  `);
  expect(snapshotInstanceManager.values).toMatchInlineSnapshot(`
    Map {
      -1 => {
        "children": [
          {
            "children": [
              {
                "children": undefined,
                "extraProps": undefined,
                "id": 3,
                "type": null,
                "values": [
                  0,
                ],
              },
            ],
            "extraProps": undefined,
            "id": 2,
            "type": "__Card__:__snapshot_e8d0a_test_4",
            "values": [
              "2:0:",
            ],
          },
        ],
        "extraProps": undefined,
        "id": -1,
        "type": "root",
        "values": undefined,
      },
      2 => {
        "children": [
          {
            "children": undefined,
            "extraProps": undefined,
            "id": 3,
            "type": null,
            "values": [
              0,
            ],
          },
        ],
        "extraProps": undefined,
        "id": 2,
        "type": "__Card__:__snapshot_e8d0a_test_4",
        "values": [
          "2:0:",
        ],
      },
      3 => {
        "children": undefined,
        "extraProps": undefined,
        "id": 3,
        "type": null,
        "values": [
          0,
        ],
      },
    }
  `);
  expect(__globalSnapshotPatch).toMatchInlineSnapshot(`[]`);
  fireEvent.tap(buttonNode);
  expect(__globalSnapshotPatch).toMatchInlineSnapshot(`[]`);
  expect(callLepusMethodCalls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"snapshotPatch":[0,"__Card__:__snapshot_e8d0a_test_4",2,4,2,[1],0,null,3,4,3,[0],1,2,3,null,1,-1,2,null],"id":2}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"id":3,"snapshotPatch":[3,3,0,1]}]}",
          "patchOptions": {
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
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
        Event {
          "eventName": "tap",
          "eventType": "bindEvent",
          "isTrusted": false,
        },
      ],
    ]
  `);

  vi.clearAllMocks();
});
