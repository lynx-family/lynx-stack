import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { render, fireEvent } from '..';
import { expect } from 'vitest';
import { useState } from 'preact/hooks';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/snapshot/debug/formatPatch';

describe('should not reuse cross slot index', () => {
  it('raw text should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const Comp = () => {
      return <text>Comp</text>;
    };

    let setState;
    const App = () => {
      let [state, _setState] = useState(1);
      setState = _setState;

      return (
        <view
          data-testid='view'
          bindtap={() => {
            setState(state === 1 ? 2 : 1);
          }}
        >
          {state === 1 ? <Comp /> : 'RawText2'}
          <text>---</text>
          <text>{'RawText'}</text>
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              Comp
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <text>
            RawText
          </text>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_2",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_1",
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": null,
          },
          {
            "id": 4,
            "op": "SetAttributes",
            "values": [
              "RawText",
            ],
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
        ]
      `);
    }

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            RawText2
          </wrapper>
          <text>
            ---
          </text>
          <text>
            RawText
          </text>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 3,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": null,
          },
          {
            "dynamicPartIndex": 0,
            "id": 5,
            "op": "SetAttribute",
            "value": "RawText2",
          },
          {
            "beforeId": 4,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
        ]
      `);
    }
  });

  it('text node should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const Comp = () => {
      return <text>Comp</text>;
    };

    let setState;
    const App = () => {
      let [state, _setState] = useState(1);
      setState = _setState;

      const textJsx = <text>A</text>;

      return (
        <view
          data-testid='view'
          bindtap={() => {
            setState(state === 1 ? 2 : 1);
          }}
        >
          {state === 1 ? <Comp /> : textJsx}
          <text>---</text>
          {textJsx}
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              Comp
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              A
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_5",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_3",
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_4",
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
        ]
      `);
    }

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              A
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              A
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 3,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_4",
          },
          {
            "beforeId": 4,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
        ]
      `);
    }
  });

  it('keyed text node should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const Comp = () => {
      return <text>Comp</text>;
    };

    let setState;
    const App = () => {
      let [state, _setState] = useState(1);
      setState = _setState;

      const textJsx = <text key='text'>A</text>;

      return (
        <view
          data-testid='view'
          bindtap={() => {
            setState(state === 1 ? 2 : 1);
          }}
        >
          {state === 1 ? <Comp /> : textJsx}
          <text>---</text>
          {textJsx}
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              Comp
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              A
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_8",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_6",
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_7",
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
        ]
      `);
    }

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper />
          <text>
            ---
          </text>
          <wrapper>
            <text>
              A
            </text>
            <text>
              A
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 3,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_7",
          },
          {
            "beforeId": null,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
        ]
      `);
    }
  });

  it('function component should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const CompA = () => {
      return <text>CompA</text>;
    };
    const CompB = () => {
      return <text>CompB</text>;
    };

    let setState;
    const App = () => {
      let [state, _setState] = useState(1);
      setState = _setState;

      return (
        <view
          data-testid='view'
          bindtap={() => {
            setState(state === 1 ? 2 : 1);
          }}
        >
          {state === 1 ? <CompA /> : <CompB />}
          <text>---</text>
          {<CompB />}
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              CompA
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              CompB
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_11",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_9",
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_10",
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
        ]
      `);
    }

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              CompB
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              CompB
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 3,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_10",
          },
          {
            "beforeId": 4,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
        ]
      `);
    }
  });

  it('keyed function component should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const CompA = () => {
      return <text>CompA</text>;
    };
    const CompB = () => {
      return <text>CompB</text>;
    };

    let setState;
    const App = () => {
      let [state, _setState] = useState(1);
      setState = _setState;

      return (
        <view
          data-testid='view'
          bindtap={() => {
            setState(state === 1 ? 2 : 1);
          }}
        >
          {state === 1 ? <CompA key='CompA' /> : <CompB key='CompB' />}
          <text>---</text>
          {<CompB key='CompB' />}
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper>
            <text>
              CompA
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              CompB
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_14",
          },
          {
            "id": 2,
            "op": "SetAttributes",
            "values": [
              1,
            ],
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_12",
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 4,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_13",
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
            "slotIndex": 0,
          },
        ]
      `);
    }

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <wrapper />
          <text>
            ---
          </text>
          <wrapper>
            <text>
              CompB
            </text>
            <text>
              CompB
            </text>
          </wrapper>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "childId": 3,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_13",
          },
          {
            "beforeId": null,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
        ]
      `);
    }
  });
});
