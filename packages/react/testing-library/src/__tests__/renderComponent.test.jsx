import { expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';

import { render, act } from '..';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/snapshot/debug/formatPatch';

test('setState generates insertBefore operation', async () => {
  vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
  const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

  let setList;
  const App = () => {
    const [list, _setList] = useState([1, 2, 3, 4]);
    setList = _setList;
    return (
      <view>
        <view></view>
        {list.map(key => (
          <view key={key}>
            <text>{key}</text>
          </view>
        ))}
      </view>
    );
  };

  render(<App />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });

  expect(callLepusMethodCalls[0]).toMatchInlineSnapshot(`
    [
      "rLynxChange",
      {
        "data": "{"patchList":[{"snapshotPatch":[],"id":2}]}",
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
    ]
  `);
  {
    const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
    const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formattedSnapshotPatch).toMatchInlineSnapshot(`[]`);
  }

  expect(elementTree).toMatchInlineSnapshot(`
    <page>
      <view>
        <view />
        <wrapper>
          <view>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              2
            </text>
          </view>
          <view>
            <text>
              3
            </text>
          </view>
          <view>
            <text>
              4
            </text>
          </view>
        </wrapper>
      </view>
    </page>
  `);

  act(() => {
    setList([1, 3, 2, 4]);
  });

  expect(callLepusMethodCalls[1]).toMatchInlineSnapshot(`
    [
      "rLynxChange",
      {
        "data": "{"patchList":[{"id":3,"snapshotPatch":[1,-2,-5,-9,0]}]}",
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
    ]
  `);
  const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
  const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
  expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
    [
      {
        "beforeId": -9,
        "childId": -5,
        "op": "InsertBefore",
        "parentId": -2,
        "slotIndex": 0,
      },
    ]
  `);

  expect(elementTree).toMatchInlineSnapshot(`
    <page>
      <view>
        <view />
        <wrapper>
          <view>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              3
            </text>
          </view>
          <view>
            <text>
              2
            </text>
          </view>
          <view>
            <text>
              4
            </text>
          </view>
        </wrapper>
      </view>
    </page>
  `);
});

test('setState triggered renderComponent should have correct slotIndex', async () => {
  vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
  const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

  const Parent = ({ children }) => {
    const text = 'parent';
    return (
      <view>
        <text>{text}</text>
        <text>Split</text>
        {children}
      </view>
    );
  };
  let setCount;
  const Child = () => {
    const [count, _setCount] = useState(0);
    setCount = _setCount;
    return (
      count === 0
        ? (
          <view>
            <text>{count}</text>
          </view>
        )
        : (
          <view>
            <text>{count}</text>
          </view>
        )
    );
  };
  const App = () => {
    return (
      <Parent>
        <Child />
      </Parent>
    );
  };

  render(<App />, {
    enableMainThread: true,
    enableBackgroundThread: true,
  });

  expect(JSON.stringify(JSON.parse(onLifecycleEventCalls[0][0][1]['root']), null, 2)).toMatchInlineSnapshot(`
    "{
      "id": -1,
      "type": "root",
      "children": [
        {
          "id": -2,
          "type": "__snapshot_289e0_test_3",
          "children": [
            {
              "id": -3,
              "type": null,
              "values": [
                "parent"
              ]
            },
            {
              "id": -4,
              "type": "__snapshot_289e0_test_4",
              "children": [
                {
                  "id": -5,
                  "type": null,
                  "values": [
                    0
                  ]
                }
              ],
              "slotIndex": 1
            }
          ]
        }
      ]
    }"
  `);

  expect(elementTree).toMatchInlineSnapshot(`
    <page>
      <view>
        <text>
          parent
        </text>
        <text>
          Split
        </text>
        <wrapper>
          <view>
            <text>
              0
            </text>
          </view>
        </wrapper>
      </view>
    </page>
  `);

  act(() => {
    setCount(1);
  });

  expect(callLepusMethodCalls[1]).toMatchInlineSnapshot(`
    [
      "rLynxChange",
      {
        "data": "{"patchList":[{"id":3,"snapshotPatch":[2,-2,-4,0,"__snapshot_289e0_test_5",6,0,null,7,3,7,0,1,1,6,7,null,0,1,-2,6,null,1]}]}",
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
    ]
  `);
  const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
  const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
  expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
    [
      {
        "childId": -4,
        "op": "RemoveChild",
        "parentId": -2,
      },
      {
        "id": 6,
        "op": "CreateElement",
        "type": "__snapshot_289e0_test_5",
      },
      {
        "id": 7,
        "op": "CreateElement",
        "type": null,
      },
      {
        "dynamicPartIndex": 0,
        "id": 7,
        "op": "SetAttribute",
        "value": 1,
      },
      {
        "beforeId": null,
        "childId": 7,
        "op": "InsertBefore",
        "parentId": 6,
        "slotIndex": 0,
      },
      {
        "beforeId": null,
        "childId": 6,
        "op": "InsertBefore",
        "parentId": -2,
        "slotIndex": 1,
      },
    ]
  `);
  expect(elementTree).toMatchInlineSnapshot(`
    <page>
      <view>
        <text>
          parent
        </text>
        <text>
          Split
        </text>
        <wrapper>
          <view>
            <text>
              1
            </text>
          </view>
        </wrapper>
      </view>
    </page>
  `);
});
