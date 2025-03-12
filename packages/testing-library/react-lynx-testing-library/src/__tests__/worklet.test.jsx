import { describe, expect, vi } from 'vitest';
import { fireEvent, render, waitSchedule } from '..';
import { runOnBackground } from '@lynx-js/react';

describe('worklet', () => {
  it('main-thread script should work', async () => {
    const cb = vi.fn();
    const Comp = () => {
      return (
        <view
          main-thread:bindtap={(e) => {
            'main thread';
            cb(e);
          }}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: false,
    });
    expect(container).toMatchInlineSnapshot(`
      <page
        cssId="__Card__:0"
      >
        <view
          event={
            {
              "bindEvent:tap": {
                "type": "worklet",
                "value": {
                  "_c": {
                    "cb": [MockFunction spy],
                  },
                  "_wkltId": "15ab:test:1",
                  "_workletType": "main-thread",
                },
              },
            }
          }
        >
          <text>
            <raw-text
              text="Hello Main Thread Script"
            />
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.children[0], {
      key: 'value',
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "eventName": "tap",
            "key": "value",
          },
        ],
      ]
    `);
  });
  it('main-thread script should not throw when enable background thread', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);

    globalThis.cb = vi.fn();
    const mainThreadFn = () => {
      'main thread';
      console.log('main thread');
      globalThis.cb();
    };
    mainThreadFn.cb = vi.fn();
    const Comp = () => {
      return (
        <view
          main-thread:bindtap={mainThreadFn}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp />, {
      enableMainThread: false,
      enableBackgroundThread: true,
    });

    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"snapshotPatch":[0,"__Card__:__snapshot_15ab0_test_2",2,4,2,[{"_wkltId":"15ab:test:2","_execId":1}],1,-1,2,null]}",
            "patchOptions": {
              "commitTaskId": 3,
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
    expect(container).toMatchInlineSnapshot(`
      <page
        cssId="__Card__:0"
      >
        <view
          event={
            {
              "bindEvent:tap": {
                "type": "worklet",
                "value": {
                  "_execId": 1,
                  "_wkltId": "15ab:test:2",
                  "_workletType": "main-thread",
                },
              },
            }
          }
        >
          <text>
            <raw-text
              text="Hello Main Thread Script"
            />
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.children[0], {
      key: 'value',
    });
    expect(globalThis.cb).toBeCalledTimes(1);
    expect(globalThis.cb.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    vi.resetAllMocks();
  });
  it('runOnBackground works', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);

    const cb = vi.fn();
    const Comp = () => {
      return (
        <view
          main-thread:bindtap={(e) => {
            'main thread';
            runOnBackground(() => {
              console.log('run on background');
              cb();
            })();
          }}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"snapshotPatch":[3,-2,0,{"_wkltId":"15ab:test:3","_jsFn":{"_jsFn1":{"_jsFnId":2}},"_execId":1}]}",
            "patchOptions": {
              "commitTaskId": 6,
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
    expect(container).toMatchInlineSnapshot(`
      <page
        cssId="__Card__:0"
      >
        <view
          event={
            {
              "bindEvent:tap": {
                "type": "worklet",
                "value": {
                  "_execId": 1,
                  "_jsFn": {
                    "_jsFn1": {
                      "_jsFnId": 2,
                    },
                  },
                  "_wkltId": "15ab:test:3",
                  "_workletType": "main-thread",
                },
              },
            }
          }
        >
          <text>
            <raw-text
              text="Hello Main Thread Script"
            />
          </text>
        </view>
      </page>
    `);
    debugger;
    fireEvent.tap(container.children[0], {
      key: 'value',
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    vi.resetAllMocks();
  });
});
