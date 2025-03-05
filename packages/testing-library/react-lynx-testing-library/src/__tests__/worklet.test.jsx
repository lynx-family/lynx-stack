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
                  "_wkltId": "73c2:test:1",
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

    const mainThreadFn = () => {
      'main thread';
      debugger;
      console.log('main thread');
      this.cb();
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
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"snapshotPatch":[3,-2,0,{"_wkltId":"73c2:test:2","_workletType":"main-thread","_execId":1}]}",
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
                  "_wkltId": "73c2:test:2",
                  "_workletType": "main-thread",
                  "cb": [MockFunction spy],
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
    expect(mainThreadFn.cb).toBeCalledTimes(1);
    expect(mainThreadFn.cb.mock.calls).toMatchInlineSnapshot(`
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
            "data": "{"snapshotPatch":[3,-2,0,{"_wkltId":"73c2:test:3","_jsFn":{"_jsFn1":{"_jsFnId":1}},"_execId":1}]}",
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
                      "_jsFnId": 1,
                    },
                  },
                  "_wkltId": "73c2:test:3",
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
        [],
      ]
    `);
    vi.resetAllMocks();
  });
});
