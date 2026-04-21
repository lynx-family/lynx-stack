import '@testing-library/jest-dom';
import { describe, test, vi, expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';
import { fireEvent, render } from '..';
import { act } from 'preact/test-utils';

describe('alog', () => {
  test('should log', async () => {
    vi.spyOn(lynxTestingEnv.mainThread.console, 'alog');
    vi.spyOn(lynxTestingEnv.backgroundThread.console, 'alog');

    let _setCount;
    function App() {
      const [count, setCount] = useState(0);
      _setCount = setCount;
      function handleFocus() {
        console.log('focus');
      }
      return (
        <view>
          <text bindtap={() => setCount(count + 1)} catchfocus={handleFocus} data-testid='count-text'>
            count: {count}
          </text>
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

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    const countText = getByTestId('count-text');

    act(() => {
      fireEvent.tap(countText);
      fireEvent.focus(countText, {
        eventType: 'catchEvent',
      });
    });

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[ReactLynxDebug] FiberElement API call #1: __CreatePage("0", 0) => PAGE#0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #2: __GetElementUniqueID(PAGE#0) => 0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #3: __SetCSSId([PAGE#0], 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #4: __CreateView(0) => VIEW#1",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #5: __CreateText(0) => TEXT#2",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #6: __AddDataset(TEXT#2, "testid", "count-text")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #7: __AppendElement(VIEW#1, TEXT#2)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #8: __CreateRawText("count: ") => #text#3",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #9: __AppendElement(TEXT#2, #text#3)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #10: __CreateWrapperElement(0) => WRAPPER#4",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #11: __AppendElement(TEXT#2, WRAPPER#4)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #12: __CreateWrapperElement(0) => WRAPPER#5",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #13: __AppendElement(VIEW#1, WRAPPER#5)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #14: __AppendElement(PAGE#0, VIEW#1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #15: __AddEvent(TEXT#2, "bindEvent", "tap", "-2:0:")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #16: __AddEvent(TEXT#2, "catchEvent", "focus", "-2:1:")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #17: __CreateRawText("") => #text#6",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #18: __SetAttribute(#text#6, "text", 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #19: __AppendElement(WRAPPER#4, #text#6)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #20: __CreateView(0) => VIEW#7",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #21: __CreateRawText("Class Component") => #text#8",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #22: __AppendElement(VIEW#7, #text#8)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #23: __AppendElement(WRAPPER#5, VIEW#7)",
        ],
        [
          "[MainThread Component Render] name: ClassComponent",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #24: __CreateView(0) => VIEW#9",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #25: __CreateRawText("Function Component") => #text#10",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #26: __AppendElement(VIEW#9, #text#10)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #27: __AppendElement(WRAPPER#5, VIEW#9)",
        ],
        [
          "[MainThread Component Render] name: FunctionComponent",
        ],
        [
          "[MainThread Component Render] name: App",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #28: __OnLifecycleEvent(["rLynxFirstScreen", {"root":"{\\"id\\":-1,\\"type\\":\\"root\\",\\"children\\":[{\\"id\\":-2,\\"type\\":\\"__snapshot_d6fb6_test_1\\",\\"values\\":[\\"-2:0:\\",\\"-2:1:\\"],\\"children\\":[{\\"id\\":-3,\\"type\\":null,\\"values\\":[0]},{\\"id\\":-4,\\"type\\":\\"__snapshot_d6fb6_test_2\\",\\"slotIndex\\":1},{\\"id\\":-5,\\"type\\":\\"__snapshot_d6fb6_test_3\\",\\"slotIndex\\":1}]}]}","jsReadyEventIdSwap":{}}])",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: 4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: 5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: 4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: 2",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_1, __id: 2",
        ],
        [
          "[ReactLynxDebug] MTS -> BTS OnLifecycleEvent:
      {
        "root": {
          "id": -1,
          "type": "root",
          "children": [
            {
              "id": -2,
              "type": "__snapshot_d6fb6_test_1",
              "values": [
                "-2:0:",
                "-2:1:"
              ],
              "children": [
                {
                  "id": -3,
                  "type": null,
                  "values": [
                    0
                  ]
                },
                {
                  "id": -4,
                  "type": "__snapshot_d6fb6_test_2",
                  "slotIndex": 1
                },
                {
                  "id": -5,
                  "type": "__snapshot_d6fb6_test_3",
                  "slotIndex": 1
                }
              ]
            }
          ]
        },
        "jsReadyEventIdSwap": {}
      }",
        ],
        [
          "[ReactLynxDebug] SnapshotInstance tree for first screen hydration:
      | -1(root): undefined
        | -2(__snapshot_d6fb6_test_1): ["-2:0:","-2:1:"]
          | -3(null): [0]
          | -4(__snapshot_d6fb6_test_2): undefined
          | -5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BackgroundSnapshotInstance tree before hydration:
      | 1(root): undefined
        | 2(__snapshot_d6fb6_test_1): [null,null]
          | 3(null): [0]
          | 4(__snapshot_d6fb6_test_2): undefined
          | 5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BackgroundSnapshotInstance after hydration:
      | -1(root): undefined
        | -2(__snapshot_d6fb6_test_1): [null,null]
          | -3(null): [0]
          | -4(__snapshot_d6fb6_test_2): undefined
          | -5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "snapshotPatch": [],
              "id": 2
            }
          ]
        },
        "patchOptions": {
          "isHydration": true,
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #29: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
        [
          "[ReactLynxDebug] BTS received event:
      {
        "handlerName": "-2:0:",
        "type": "bindEvent:tap",
        "snapshotType": "__snapshot_d6fb6_test_1",
        "jsFunctionName": ""
      }",
        ],
        [
          "[ReactLynxDebug] BTS received event:
      {
        "handlerName": "-2:1:",
        "type": "catchEvent:focus",
        "snapshotType": "__snapshot_d6fb6_test_1",
        "jsFunctionName": "handleFocus"
      }",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 3,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 1
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #30: __SetAttribute(#text#6, "text", 1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #31: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[ReactLynxDebug] FiberElement API call #1: __CreatePage("0", 0) => PAGE#0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #2: __GetElementUniqueID(PAGE#0) => 0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #3: __SetCSSId([PAGE#0], 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #4: __CreateView(0) => VIEW#1",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #5: __CreateText(0) => TEXT#2",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #6: __AddDataset(TEXT#2, "testid", "count-text")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #7: __AppendElement(VIEW#1, TEXT#2)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #8: __CreateRawText("count: ") => #text#3",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #9: __AppendElement(TEXT#2, #text#3)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #10: __CreateWrapperElement(0) => WRAPPER#4",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #11: __AppendElement(TEXT#2, WRAPPER#4)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #12: __CreateWrapperElement(0) => WRAPPER#5",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #13: __AppendElement(VIEW#1, WRAPPER#5)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #14: __AppendElement(PAGE#0, VIEW#1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #15: __AddEvent(TEXT#2, "bindEvent", "tap", "-2:0:")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #16: __AddEvent(TEXT#2, "catchEvent", "focus", "-2:1:")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #17: __CreateRawText("") => #text#6",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #18: __SetAttribute(#text#6, "text", 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #19: __AppendElement(WRAPPER#4, #text#6)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #20: __CreateView(0) => VIEW#7",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #21: __CreateRawText("Class Component") => #text#8",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #22: __AppendElement(VIEW#7, #text#8)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #23: __AppendElement(WRAPPER#5, VIEW#7)",
        ],
        [
          "[MainThread Component Render] name: ClassComponent",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #24: __CreateView(0) => VIEW#9",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #25: __CreateRawText("Function Component") => #text#10",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #26: __AppendElement(VIEW#9, #text#10)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #27: __AppendElement(WRAPPER#5, VIEW#9)",
        ],
        [
          "[MainThread Component Render] name: FunctionComponent",
        ],
        [
          "[MainThread Component Render] name: App",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #28: __OnLifecycleEvent(["rLynxFirstScreen", {"root":"{\\"id\\":-1,\\"type\\":\\"root\\",\\"children\\":[{\\"id\\":-2,\\"type\\":\\"__snapshot_d6fb6_test_1\\",\\"values\\":[\\"-2:0:\\",\\"-2:1:\\"],\\"children\\":[{\\"id\\":-3,\\"type\\":null,\\"values\\":[0]},{\\"id\\":-4,\\"type\\":\\"__snapshot_d6fb6_test_2\\",\\"slotIndex\\":1},{\\"id\\":-5,\\"type\\":\\"__snapshot_d6fb6_test_3\\",\\"slotIndex\\":1}]}]}","jsReadyEventIdSwap":{}}])",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: 4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: 5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: 4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: 2",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_1, __id: 2",
        ],
        [
          "[ReactLynxDebug] MTS -> BTS OnLifecycleEvent:
      {
        "root": {
          "id": -1,
          "type": "root",
          "children": [
            {
              "id": -2,
              "type": "__snapshot_d6fb6_test_1",
              "values": [
                "-2:0:",
                "-2:1:"
              ],
              "children": [
                {
                  "id": -3,
                  "type": null,
                  "values": [
                    0
                  ]
                },
                {
                  "id": -4,
                  "type": "__snapshot_d6fb6_test_2",
                  "slotIndex": 1
                },
                {
                  "id": -5,
                  "type": "__snapshot_d6fb6_test_3",
                  "slotIndex": 1
                }
              ]
            }
          ]
        },
        "jsReadyEventIdSwap": {}
      }",
        ],
        [
          "[ReactLynxDebug] SnapshotInstance tree for first screen hydration:
      | -1(root): undefined
        | -2(__snapshot_d6fb6_test_1): ["-2:0:","-2:1:"]
          | -3(null): [0]
          | -4(__snapshot_d6fb6_test_2): undefined
          | -5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BackgroundSnapshotInstance tree before hydration:
      | 1(root): undefined
        | 2(__snapshot_d6fb6_test_1): [null,null]
          | 3(null): [0]
          | 4(__snapshot_d6fb6_test_2): undefined
          | 5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BackgroundSnapshotInstance after hydration:
      | -1(root): undefined
        | -2(__snapshot_d6fb6_test_1): [null,null]
          | -3(null): [0]
          | -4(__snapshot_d6fb6_test_2): undefined
          | -5(__snapshot_d6fb6_test_3): undefined",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "snapshotPatch": [],
              "id": 2
            }
          ]
        },
        "patchOptions": {
          "isHydration": true,
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #29: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
        [
          "[ReactLynxDebug] BTS received event:
      {
        "handlerName": "-2:0:",
        "type": "bindEvent:tap",
        "snapshotType": "__snapshot_d6fb6_test_1",
        "jsFunctionName": ""
      }",
        ],
        [
          "[ReactLynxDebug] BTS received event:
      {
        "handlerName": "-2:1:",
        "type": "catchEvent:focus",
        "snapshotType": "__snapshot_d6fb6_test_1",
        "jsFunctionName": "handleFocus"
      }",
        ],
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 3,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 1
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #30: __SetAttribute(#text#6, "text", 1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #31: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);

    lynxTestingEnv.mainThread.console.alog.mockClear();
    lynxTestingEnv.backgroundThread.console.alog.mockClear();

    act(() => {
      _setCount(0);
    });

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 4,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 0
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #32: __SetAttribute(#text#6, "text", 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #33: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 4,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 0
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #32: __SetAttribute(#text#6, "text", 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #33: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);

    lynxTestingEnv.mainThread.console.alog.mockClear();
    lynxTestingEnv.backgroundThread.console.alog.mockClear();

    act(() => {
      _setCount(1);
    });

    expect(lynxTestingEnv.mainThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 5,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 1
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #34: __SetAttribute(#text#6, "text", 1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #35: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);
    expect(lynxTestingEnv.backgroundThread.console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[BackgroundThread Component Render] name: ClassComponent, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: FunctionComponent, uniqID: __snapshot_d6fb6_test_3, __id: -5",
        ],
        [
          "[BackgroundThread Component Render] name: Fragment, uniqID: __snapshot_d6fb6_test_2, __id: -4",
        ],
        [
          "[BackgroundThread Component Render] name: App, uniqID: __snapshot_d6fb6_test_1, __id: -2",
        ],
        [
          "[ReactLynxDebug] BTS -> MTS updateMainThread:
      {
        "data": {
          "patchList": [
            {
              "id": 5,
              "snapshotPatch": [
                {
                  "op": "SetAttribute",
                  "id": -3,
                  "dynamicPartIndex": 0,
                  "value": 1
                }
              ]
            }
          ]
        },
        "patchOptions": {
          "reloadVersion": 0,
          "pipelineOptions": {
            "pipelineID": "pipelineID",
            "needTimestamps": true,
            "pipelineOrigin": "reactLynxHydrate",
            "dsl": "reactLynx",
            "stage": "hydrate"
          }
        }
      }",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #34: __SetAttribute(#text#6, "text", 1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #35: __FlushElementTree(PAGE#0, {"pipelineOptions":{"pipelineID":"pipelineID","needTimestamps":true,"pipelineOrigin":"reactLynxHydrate","dsl":"reactLynx","stage":"hydrate"}})",
        ],
      ]
    `);
  });
});
