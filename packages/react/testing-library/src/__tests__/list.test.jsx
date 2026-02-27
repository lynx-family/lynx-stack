// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect } from 'vitest';

import { Component, useState } from '@lynx-js/react';

import { render } from '..';
import { __pendingListUpdates } from '../../../runtime/lib/pendingListUpdates.js';

describe('list', () => {
  it('basic', async () => {
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    const Comp = () => {
      const [list, setList] = useState([0, 1, 2]);
      return (
        <list>
          {list.map((item) => (
            <list-item key={item} item-key={item}>
              <text>{item}</text>
            </list-item>
          ))}
        </list>
      );
    };

    const { container } = render(<Comp />);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);
    const list = container.firstChild;
    expect(list.props).toMatchInlineSnapshot(`undefined`);
    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <wrapper>
              <text>
                0
              </text>
            </wrapper>
          </list-item>
        </list>
      </page>
    `);
    const uid1 = elementTree.enterListItemAtIndex(list, 1);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <wrapper>
              <text>
                0
              </text>
            </wrapper>
          </list-item>
          <list-item
            item-key="1"
          >
            <wrapper>
              <text>
                1
              </text>
            </wrapper>
          </list-item>
        </list>
      </page>
    `);
    expect(uid0).toMatchInlineSnapshot(`2`);
    expect(uid1).toMatchInlineSnapshot(`6`);
    elementTree.leaveListItem(list, uid0);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <wrapper>
              <text>
                0
              </text>
            </wrapper>
          </list-item>
          <list-item
            item-key="1"
          >
            <wrapper>
              <text>
                1
              </text>
            </wrapper>
          </list-item>
        </list>
      </page>
    `);
    const uid2 = elementTree.enterListItemAtIndex(list, 2);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(
      `{}`,
    );
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="2"
          >
            <wrapper>
              <text>
                2
              </text>
            </wrapper>
          </list-item>
          <list-item
            item-key="1"
          >
            <wrapper>
              <text>
                1
              </text>
            </wrapper>
          </list-item>
        </list>
      </page>
    `);
    expect(uid2).toMatchInlineSnapshot(`2`);
    expect(uid0).toBe(uid2);
  });
  it('should reuse removed list item', async () => {
    let setListVal;
    let initListVal = Array(6)
      .fill(0)
      .map((v, i) => i);

    const A = () => {
      return <text>hello</text>;
    };
    const Comp = () => {
      const [listVal, _setListVal] = useState(initListVal);
      setListVal = _setListVal;
      const showMask = true;

      return (
        <view
          style={{
            width: '100vw',
            height: '100vh',
          }}
        >
          {
            <list
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              {listVal.map((v) => {
                return (
                  <list-item item-key={`${v}`} key={v} full-span>
                    <view>
                      {showMask ? <text>{v}</text> : null}
                      {showMask ? <text>{v}</text> : null}
                    </view>
                    {/* This will generate `__DynamicPartSlot` part for testing the hydration behavior of slot is as expected */}
                    <view>
                      <A />
                    </view>
                  </list-item>
                );
              })}
            </list>
          }
        </view>
      );
    };

    const { container } = render(<Comp />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          style="width:100vw;height:100vh"
        >
          <list
            style="width:100%;height:100%"
            update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_7","item-key":"0","full-span":true},{"position":1,"type":"__snapshot_a9e46_test_7","item-key":"1","full-span":true},{"position":2,"type":"__snapshot_a9e46_test_7","item-key":"2","full-span":true},{"position":3,"type":"__snapshot_a9e46_test_7","item-key":"3","full-span":true},{"position":4,"type":"__snapshot_a9e46_test_7","item-key":"4","full-span":true},{"position":5,"type":"__snapshot_a9e46_test_7","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]}]"
          />
        </view>
      </page>
    `);
    const list = container.firstChild.firstChild;

    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    const uid1 = elementTree.enterListItemAtIndex(list, 1);
    const uid2 = elementTree.enterListItemAtIndex(list, 2);
    const uid3 = elementTree.enterListItemAtIndex(list, 3);

    const listItem3 = list.children[3];
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="3"
      >
        <wrapper>
          <view>
            <text>
              3
            </text>
            <text>
              3
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </wrapper>
      </list-item>
    `);

    elementTree.leaveListItem(list, uid0);
    const uid4 = elementTree.enterListItemAtIndex(list, 4);
    expect(uid4).toBe(uid0);

    elementTree.leaveListItem(list, uid1);
    const uid5 = elementTree.enterListItemAtIndex(list, 5);
    expect(uid5).toBe(uid1);

    // Remove the element 3
    act(() => {
      setListVal(initListVal.filter((x) => x !== 3));
    });

    const __CreateElement = vi.spyOn(globalThis, '__CreateElement');
    const __SetAttribute = vi.spyOn(globalThis, '__SetAttribute');
    const __FlushElementTree = vi.spyOn(globalThis, '__FlushElementTree');

    // Remove action is generated
    expect(JSON.parse(list.getAttribute('update-list-info'))[1].removeAction)
      .toMatchInlineSnapshot(`
      [
        3,
      ]
    `);
    // Reuse the element 3
    elementTree.leaveListItem(list, uid3);
    elementTree.enterListItemAtIndex(list, 1);

    expect(__CreateElement).toHaveBeenCalledTimes(0);
    expect(__SetAttribute).toHaveBeenCalledTimes(4);
    // The original FiberElement of element 3 is reused for
    // element 1 now
    expect(__SetAttribute.mock.calls[0][0]).toBe(listItem3);
    expect(__SetAttribute.mock.calls[0][0].$$uiSign).toBe(uid3);
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="1"
      >
        <wrapper>
          <view>
            <text>
              1
            </text>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </wrapper>
      </list-item>
    `);

    expect(__SetAttribute.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <wrapper>
              <view>
                <text>
                  1
                </text>
                <text>
                  1
                </text>
              </view>
              <view>
                <text>
                  hello
                </text>
              </view>
            </wrapper>
          </list-item>,
          "item-key",
          "1",
        ],
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <wrapper>
              <view>
                <text>
                  1
                </text>
                <text>
                  1
                </text>
              </view>
              <view>
                <text>
                  hello
                </text>
              </view>
            </wrapper>
          </list-item>,
          "full-span",
          true,
        ],
        [
          1,
          "text",
          1,
        ],
        [
          1,
          "text",
          1,
        ],
      ]
    `);
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
    expect(__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <wrapper>
              <view>
                <text>
                  1
                </text>
                <text>
                  1
                </text>
              </view>
              <view>
                <text>
                  hello
                </text>
              </view>
            </wrapper>
          </list-item>,
          {
            "elementID": 33,
            "listID": 2,
            "operationID": undefined,
            "triggerLayout": true,
          },
        ],
      ]
    `);

    expect(list).toMatchInlineSnapshot(`
      <list
        style="width:100%;height:100%"
        update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_7","item-key":"0","full-span":true},{"position":1,"type":"__snapshot_a9e46_test_7","item-key":"1","full-span":true},{"position":2,"type":"__snapshot_a9e46_test_7","item-key":"2","full-span":true},{"position":3,"type":"__snapshot_a9e46_test_7","item-key":"3","full-span":true},{"position":4,"type":"__snapshot_a9e46_test_7","item-key":"4","full-span":true},{"position":5,"type":"__snapshot_a9e46_test_7","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]},{"insertAction":[],"removeAction":[3],"updateAction":[]}]"
      >
        <list-item
          full-span="true"
          item-key="4"
        >
          <wrapper>
            <view>
              <text>
                4
              </text>
              <text>
                4
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </wrapper>
        </list-item>
        <list-item
          full-span="true"
          item-key="5"
        >
          <wrapper>
            <view>
              <text>
                5
              </text>
              <text>
                5
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </wrapper>
        </list-item>
        <list-item
          full-span="true"
          item-key="2"
        >
          <wrapper>
            <view>
              <text>
                2
              </text>
              <text>
                2
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </wrapper>
        </list-item>
        <list-item
          full-span="true"
          item-key="1"
        >
          <wrapper>
            <view>
              <text>
                1
              </text>
              <text>
                1
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </wrapper>
        </list-item>
      </list>
    `);
  });

  it('should recursively destroy list', async () => {
    let setHide;
    const Comp = () => {
      const [hide, _setHide] = useState(false);
      setHide = _setHide;

      if (hide) return null;

      return (
        <view
          style={{
            width: '100vw',
            height: '100vh',
          }}
        >
          {
            <list
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              {Array(6)
                .fill(0)
                .map((v, i) => i).map((v) => {
                  return (
                    <list-item item-key={`${v}`} key={v} full-span>
                      <view>
                        {'Hello'}
                      </view>
                    </list-item>
                  );
                })}
            </list>
          }
        </view>
      );
    };

    const { container } = render(<Comp />);

    const list = container.firstChild.firstChild;
    const uid0 = elementTree.enterListItemAtIndex(list, 0);

    // Hide all
    act(() => {
      setHide(true);
    });
  });
});

describe('list - deferred <list-item/> should render as normal', () => {
  it('basic', async () => {
    function App() {
      return (
        <list
          custom-list-name='list-container'
          style='height: 700rpx; width: 700rpx; background-color: #f0f0f0;'
        >
          <list-item item-key='x' defer>
            <view style='height: 50rpx; width: 600rpx; background-color: red;' />
          </list-item>

          {Array.from({ length: 3 }).map((_, index) => (
            <list-item item-key={`${index}`} key={index} defer>
              <view style='height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;'>
                <text style='padding: 10rpx;'>Item {index + 1}</text>
              </view>
            </list-item>
          ))}
        </list>
      );
    }

    const { container } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_17","item-key":"x"},{"position":1,"type":"__snapshot_a9e46_test_19","item-key":"0"},{"position":2,"type":"__snapshot_a9e46_test_19","item-key":"1"},{"position":3,"type":"__snapshot_a9e46_test_19","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);

    const list = container.firstChild;

    const p = [
      elementTree.enterListItemAtIndex(list, 0),
      elementTree.enterListItemAtIndex(list, 1),
      elementTree.enterListItemAtIndex(list, 2),
      elementTree.enterListItemAtIndex(list, 3),
    ];

    expect(p[0].then).toBeTypeOf('function');
    expect(p[1].then).toBeTypeOf('function');
    expect(p[2].then).toBeTypeOf('function');
    expect(p[3].then).toBeTypeOf('function');

    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_17","item-key":"x"},{"position":1,"type":"__snapshot_a9e46_test_19","item-key":"0"},{"position":2,"type":"__snapshot_a9e46_test_19","item-key":"1"},{"position":3,"type":"__snapshot_a9e46_test_19","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);

    await Promise.all(p);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_17","item-key":"x"},{"position":1,"type":"__snapshot_a9e46_test_19","item-key":"0"},{"position":2,"type":"__snapshot_a9e46_test_19","item-key":"1"},{"position":3,"type":"__snapshot_a9e46_test_19","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="x"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: red;"
            />
          </list-item>
          <list-item
            item-key="0"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;"
            >
              <text
                style="padding: 10rpx;"
              >
                Item 
                <wrapper>
                  1
                </wrapper>
              </text>
            </view>
          </list-item>
          <list-item
            item-key="1"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;"
            >
              <text
                style="padding: 10rpx;"
              >
                Item 
                <wrapper>
                  2
                </wrapper>
              </text>
            </view>
          </list-item>
          <list-item
            item-key="2"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;"
            >
              <text
                style="padding: 10rpx;"
              >
                Item 
                <wrapper>
                  3
                </wrapper>
              </text>
            </view>
          </list-item>
        </list>
      </page>
    `);
  });

  it('switch from defer={false} to defer={true} and backwards', async () => {
    let _setDefers;

    class C extends Component {
      componentWillUnmount() {
        this.props.onUnmount?.();
      }

      render() {
        this.props.onRender?.();
        return null;
      }
    }

    const unmounts = [vi.fn(), vi.fn(), vi.fn()];
    const renders = [vi.fn(), vi.fn(), vi.fn()];

    function App() {
      const [defers, setDefers] = useState([true, true, false]);
      _setDefers = setDefers;

      return (
        <list
          custom-list-name='list-container'
          style='height: 700rpx; width: 700rpx; background-color: #f0f0f0;'
        >
          <list-item item-key='x' defer>
            <view style='height: 50rpx; width: 600rpx; background-color: red;' />
          </list-item>

          {Array.from({ length: 3 }).map((_, index) => (
            <list-item item-key={`${index}`} key={index} defer={defers[index]}>
              <view style='height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;'>
                <text style='padding: 10rpx;'>Item {index + 1}</text>
                <C onUnmount={unmounts[index]} onRender={renders[index]} />
              </view>
            </list-item>
          ))}
        </list>
      );
    }

    const { container } = render(<App />);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_22","item-key":"x"},{"position":1,"type":"__snapshot_a9e46_test_24","item-key":"0"},{"position":2,"type":"__snapshot_a9e46_test_24","item-key":"1"},{"position":3,"type":"__snapshot_a9e46_test_24","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);

    expect(renders[2]).toHaveBeenCalledTimes(1);

    act(() => {
      _setDefers([true, true, true]);
    });

    expect(renders[0]).toHaveBeenCalledTimes(0);
    expect(renders[2]).toHaveBeenCalledTimes(2);
    expect(unmounts[2]).toHaveBeenCalledTimes(0); // should not unmount, because it will be a pure waste

    act(() => {
      _setDefers([false, true, true]);
    });

    expect(renders[0]).toHaveBeenCalledTimes(1); // change from defer={true} to defer={false} should render the component
  });

  it('should unmount when reused', async () => {
    class U extends Component {
      componentWillUnmount() {
        this.props.onUnmount?.();
      }
      render() {
        return null;
      }
    }

    const unmounts = [vi.fn(), vi.fn(), vi.fn()];

    function App() {
      return (
        <list
          custom-list-name='list-container'
          style='height: 700rpx; width: 700rpx; background-color: #f0f0f0;'
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <list-item item-key={`${index}`} key={index} defer={{ unmountRecycled: true }}>
              <view style='height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;'>
                <text style='padding: 10rpx;'>Item {index + 1}</text>
              </view>
              <U onUnmount={unmounts[index]} />
            </list-item>
          ))}
        </list>
      );
    }

    const { container } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_27","item-key":"0"},{"position":1,"type":"__snapshot_a9e46_test_27","item-key":"1"},{"position":2,"type":"__snapshot_a9e46_test_27","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);

    const list = container.firstChild;

    const p = [
      elementTree.enterListItemAtIndex(list, 0),
      elementTree.enterListItemAtIndex(list, 1),
    ];

    expect(p[0].then).toBeTypeOf('function');
    expect(p[1].then).toBeTypeOf('function');

    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_27","item-key":"0"},{"position":1,"type":"__snapshot_a9e46_test_27","item-key":"1"},{"position":2,"type":"__snapshot_a9e46_test_27","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);

    await Promise.all(p);

    elementTree.leaveListItem(list, await p[0]);
    p[2] = elementTree.enterListItemAtIndex(list, 2);

    await Promise.all(p);

    expect(unmounts[0]).toHaveBeenCalledTimes(1);

    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          custom-list-name="list-container"
          style="height: 700rpx; width: 700rpx; background-color: #f0f0f0;"
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_a9e46_test_27","item-key":"0"},{"position":1,"type":"__snapshot_a9e46_test_27","item-key":"1"},{"position":2,"type":"__snapshot_a9e46_test_27","item-key":"2"}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="2"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;"
            >
              <text
                style="padding: 10rpx;"
              >
                Item 
                <wrapper>
                  3
                </wrapper>
              </text>
            </view>
          </list-item>
          <list-item
            item-key="1"
          >
            <view
              style="height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;"
            >
              <text
                style="padding: 10rpx;"
              >
                Item 
                <wrapper>
                  2
                </wrapper>
              </text>
            </view>
          </list-item>
        </list>
      </page>
    `);
  });

  it('spread props inside list-item should not trigger redundant snapshot patch', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const useThemeColor = () => 'red';
    const ThemedView = (props) => {
      const { style, ...otherProps } = props;
      const { children, ...restProps } = otherProps;
      const backgroundColor = useThemeColor();

      return (
        <view style={{ backgroundColor, ...style }} {...restProps}>
          {children}
        </view>
      );
    };

    const Comp = () => {
      const [list, setList] = useState([0, 1, 2]);
      return (
        <list>
          {list.map((item) => (
            <list-item key={item} item-key={item}>
              <ThemedView style={{ margin: '12px' }}>
                <text>{item}</text>
              </ThemedView>
            </list-item>
          ))}
        </list>
      );
    };

    render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(onLifecycleEventCalls).toMatchInlineSnapshot(`
      [
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a9e46_test_30","children":[{"id":-3,"type":"__snapshot_a9e46_test_31","values":[{"item-key":0}],"children":[{"id":-4,"type":"__snapshot_a9e46_test_29","values":[{"style":{"backgroundColor":"red","margin":"12px"}}],"children":[{"id":-5,"type":"__snapshot_a9e46_test_32","children":[{"id":-12,"type":null,"values":[0]}]}]}]},{"id":-6,"type":"__snapshot_a9e46_test_31","values":[{"item-key":1}],"children":[{"id":-7,"type":"__snapshot_a9e46_test_29","values":[{"style":{"backgroundColor":"red","margin":"12px"}}],"children":[{"id":-8,"type":"__snapshot_a9e46_test_32","children":[{"id":-13,"type":null,"values":[1]}]}]}]},{"id":-9,"type":"__snapshot_a9e46_test_31","values":[{"item-key":2}],"children":[{"id":-10,"type":"__snapshot_a9e46_test_29","values":[{"style":{"backgroundColor":"red","margin":"12px"}}],"children":[{"id":-11,"type":"__snapshot_a9e46_test_32","children":[{"id":-14,"type":null,"values":[2]}]}]}]}]}]}",
            },
          ],
        ],
      ]
    `);
    expect(onLifecycleEventCalls[0][0][0]).toBe('rLynxFirstScreen');
    expect(onLifecycleEventCalls[0][0][1]['root'].includes('__spread')).toBe(false);

    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
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
        ],
      ]
    `);
    expect(callLepusMethodCalls[0][0]).toBe('rLynxChange');
    expect(JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch.length).toBe(0);
  });
});
