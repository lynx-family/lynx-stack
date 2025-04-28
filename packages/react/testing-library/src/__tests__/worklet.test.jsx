import { describe, expect, vi } from 'vitest';
import { fireEvent, render, waitSchedule } from '..';
import { runOnBackground, useMainThreadRef, runOnMainThread } from '@lynx-js/react';
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
      <page>
        <view>
          <text>
            Hello Main Thread Script
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.firstChild, {
      key: 'value',
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "eventName": "tap",
            "eventType": "bindEvent",
            "isTrusted": false,
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
            "data": "{"patchList":[{"snapshotPatch":[3,-2,0,{"_wkltId":"a45f:test:2","_workletType":"main-thread","_execId":1}],"id":2}]}",
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
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <text>
            Hello Main Thread Script
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.firstChild, {
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
  it('main-thread script should not update MTS function when enable background', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);

    globalThis.cb = vi.fn();
    const mainThreadFn = (e) => {
      'main thread';
      console.log('main thread');
      globalThis.cb(e);
    };

    const Comp = (props) => {
      const {
        onClick,
      } = props;

      return (
        <view
          bindtap={e => {
            if (onClick) {
              onClick(e);
            }
          }}
          main-thread:bindtap={(e) => {
            'main thread';
            if (props['main-thread:onClick']) {
              props['main-thread:onClick'](e);
            }
          }}
        >
          <text>Hello Main Thread Script</text>
        </view>
      );
    };
    const { container } = render(<Comp main-thread:onClick={mainThreadFn} />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"patchList":[{"snapshotPatch":[3,-2,1,{"_c":{"props":{"main-thread:onClick":{"_wkltId":"a45f:test:3"}}},"_wkltId":"a45f:test:4","_execId":1}],"id":2}]}",
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
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <text>
            Hello Main Thread Script
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.firstChild, {
      key: 'value',
    });
    expect(globalThis.cb).toBeCalledTimes(1);
    expect(globalThis.cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "eventName": "tap",
            "eventType": "bindEvent",
            "isTrusted": false,
            "key": "value",
          },
        ],
      ]
    `);
    vi.resetAllMocks();
  });

  it('main thread script props', () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);

    globalThis.cb = vi.fn();
    const mainThreadFn = (e) => {
      'main thread';
      console.log('main thread');
      globalThis.cb(e);
    };

    const List = (props) => {
      return (
        <view
          main-thread:bindscroll={e => {
            'main thread';
            if (props['main-thread:onScroll']) {
              props['main-thread:onScroll'](e);
            }
          }}
        >
        </view>
      );
    };

    const { container } = render(
      <List main-thread:onScroll={mainThreadFn}></List>,
      {
        enableMainThread: true,
        enableBackgroundThread: true,
      },
    );

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view />
      </page>
    `);

    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"patchList":[{"snapshotPatch":[3,-2,0,{"_c":{"props":{"main-thread:onScroll":{"_wkltId":"a45f:test:5"}}},"_wkltId":"a45f:test:6","_execId":1}],"id":2}]}",
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

    const list = container.firstChild;
    fireEvent.scroll(list, {
      info: {
        detail: {
          scrollTop: 100,
          scrollLeft: 0,
        },
      },
    });
    expect(globalThis.cb).toBeCalledTimes(1);
  });

  it('runOnMainThread works', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);
    const Comp = () => {
      return (
        <view
          bindtap={async (e) => {
            const resp = await runOnMainThread(() => {
              'main thread';
              console.log('run on main thread');
              return 'Hello from main thread';
            })();
            expect(resp).toMatchInlineSnapshot(`"Hello from main thread"`);
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
    fireEvent.tap(container.firstChild, {
      key: 'value',
    });
    await waitSchedule();
  });

  it('runOnBackground works', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);

    const cb = vi.fn();
    globalThis.receiveRunOnBackgroundResp = vi.fn();
    const Comp = () => {
      return (
        <view
          main-thread:bindtap={async (e) => {
            'main thread';
            const resp = await runOnBackground(() => {
              console.log('run on background');
              cb();
              return 'Hello from background';
            })();
            globalThis.receiveRunOnBackgroundResp(resp);
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
            "data": "{"patchList":[{"snapshotPatch":[3,-2,0,{"_wkltId":"a45f:test:8","_jsFn":{"_jsFn1":{"_jsFnId":2}},"_execId":1}],"id":2}]}",
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
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view>
          <text>
            Hello Main Thread Script
          </text>
        </view>
      </page>
    `);
    fireEvent.tap(container.firstChild, {
      key: 'value',
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [],
      ]
    `);
    // wait for runOnBackground to finish
    await waitSchedule();
    expect(globalThis.receiveRunOnBackgroundResp).toBeCalledTimes(1);
    expect(globalThis.receiveRunOnBackgroundResp.mock.calls)
      .toMatchInlineSnapshot(`
        [
          [
            "Hello from background",
          ],
        ]
      `);
    vi.resetAllMocks();
  });

  it('worklet ref should work', async () => {
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`[]`);
    globalThis.cb = vi.fn();
    const Comp = () => {
      const ref = useMainThreadRef(null);
      const num = useMainThreadRef(0);

      const handleTap = () => {
        'main thread';
        ref.current?.setStyleProperty('background-color', 'blue');
        num.current = 100;
        globalThis.cb(num.current);
      };

      return (
        <view
          main-thread:ref={ref}
          main-thread:bindtap={handleTap}
          style={{ width: '300px', height: '300px' }}
        >
          <text>Hello main thread ref</text>
        </view>
      );
    };

    const { container } = render(<Comp />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          has-react-ref="true"
          style="width: 300px; height: 300px;"
        >
          <text>
            Hello main thread ref
          </text>
        </view>
      </page>
    `);
    expect(callLepusMethodCalls).toMatchInlineSnapshot(`
      [
        [
          "rLynxChange",
          {
            "data": "{"patchList":[{"id":1,"workletRefInitValuePatch":[[1,null],[2,0]]}]}",
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
        [
          "rLynxChange",
          {
            "data": "{"patchList":[{"snapshotPatch":[3,-2,0,{"_wvid":1},3,-2,1,{"_c":{"ref":{"_wvid":1},"num":{"_wvid":2}},"_wkltId":"a45f:test:9","_execId":1}],"id":2}]}",
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
    fireEvent.tap(container.firstChild, {
      key: 'value',
    });
    expect(globalThis.cb).toBeCalledTimes(1);
    expect(globalThis.cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          100,
        ],
      ]
    `);
  });
});
