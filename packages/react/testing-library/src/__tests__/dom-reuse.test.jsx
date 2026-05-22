import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { render, fireEvent } from '..';
import { expect } from 'vitest';
import { useState, useEffect } from 'preact/hooks';
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

  it('raw text in the middle should not be reused', () => {
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
          <text>{'RawText1'}</text>
          <text>---</text>
          {state === 1 ? <Comp /> : 'RawTextInMiddle'}
          <text>---</text>
          <text>{'RawText2'}</text>
        </view>
      );
    };
    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <text>
            RawText1
          </text>
          <text>
            ---
          </text>
          <wrapper>
            <text>
              Comp
            </text>
          </wrapper>
          <text>
            ---
          </text>
          <text>
            RawText2
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
            "type": "__snapshot_42dc9_test_4",
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
            "type": null,
          },
          {
            "id": 3,
            "op": "SetAttributes",
            "values": [
              "RawText1",
            ],
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
            "type": "__snapshot_42dc9_test_3",
          },
          {
            "beforeId": null,
            "childId": 4,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": null,
          },
          {
            "id": 5,
            "op": "SetAttributes",
            "values": [
              "RawText2",
            ],
          },
          {
            "beforeId": null,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 2,
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
          <text>
            RawText1
          </text>
          <text>
            ---
          </text>
          <wrapper>
            RawTextInMiddle
          </wrapper>
          <text>
            ---
          </text>
          <text>
            RawText2
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
            "childId": 4,
            "op": "RemoveChild",
            "parentId": 2,
          },
          {
            "id": 6,
            "op": "CreateElement",
            "type": null,
          },
          {
            "dynamicPartIndex": 0,
            "id": 6,
            "op": "SetAttribute",
            "value": "RawTextInMiddle",
          },
          {
            "beforeId": 5,
            "childId": 6,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 1,
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
            "type": "__snapshot_42dc9_test_7",
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
            "type": "__snapshot_42dc9_test_5",
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
            "type": "__snapshot_42dc9_test_6",
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
            "type": "__snapshot_42dc9_test_6",
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
            "type": "__snapshot_42dc9_test_10",
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
            "type": "__snapshot_42dc9_test_8",
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
            "type": "__snapshot_42dc9_test_9",
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
            "type": "__snapshot_42dc9_test_9",
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
            "type": "__snapshot_42dc9_test_13",
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
            "type": "__snapshot_42dc9_test_11",
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
            "type": "__snapshot_42dc9_test_12",
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
            "type": "__snapshot_42dc9_test_12",
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
            "type": "__snapshot_42dc9_test_16",
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
            "type": "__snapshot_42dc9_test_14",
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
            "type": "__snapshot_42dc9_test_15",
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
            "type": "__snapshot_42dc9_test_15",
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

  it('keyed function component in Fragment should not be reused', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const log = [];
    const CompA = () => {
      return <text>CompA</text>;
    };
    const CompB = ({ name }) => {
      useEffect(() => {
        log.push(`mount ${name}`);
        return () => {
          log.push(`unmount ${name}`);
        };
      }, []);

      return <text>{name}</text>;
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
          {state === 1 ? <CompA key='CompA' name='CompA' /> : [
            // slot 0 Fragment[0] intentionally shares `key='CompB'` with slot 1 below to
            // exercise cross-scope duplicate-key isolation; the distinct `name` prop lets
            // us identify each instance in the mount/unmount log.
            <CompB key='CompB' name='CompB-0' />,
            <CompB key='CompB-1' name='CompB-1' />,
            <CompB key='CompB-2' name='CompB-2' />,
          ]}
          <text>---</text>
          {<CompB key='CompB' name='CompB' />}
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
            "type": "__snapshot_42dc9_test_19",
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
            "type": "__snapshot_42dc9_test_17",
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
            "type": "__snapshot_42dc9_test_18",
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": null,
          },
          {
            "id": 5,
            "op": "SetAttributes",
            "values": [
              "CompB",
            ],
          },
          {
            "beforeId": null,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": 4,
            "slotIndex": 0,
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
              CompB-0
            </text>
            <text>
              CompB-1
            </text>
            <text>
              CompB-2
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
            "id": 6,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_18",
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
            "value": "CompB-0",
          },
          {
            "beforeId": null,
            "childId": 7,
            "op": "InsertBefore",
            "parentId": 6,
            "slotIndex": 0,
          },
          {
            "beforeId": 4,
            "childId": 6,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 8,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_18",
          },
          {
            "id": 9,
            "op": "CreateElement",
            "type": null,
          },
          {
            "dynamicPartIndex": 0,
            "id": 9,
            "op": "SetAttribute",
            "value": "CompB-1",
          },
          {
            "beforeId": null,
            "childId": 9,
            "op": "InsertBefore",
            "parentId": 8,
            "slotIndex": 0,
          },
          {
            "beforeId": 4,
            "childId": 8,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
          {
            "id": 10,
            "op": "CreateElement",
            "type": "__snapshot_42dc9_test_18",
          },
          {
            "id": 11,
            "op": "CreateElement",
            "type": null,
          },
          {
            "dynamicPartIndex": 0,
            "id": 11,
            "op": "SetAttribute",
            "value": "CompB-2",
          },
          {
            "beforeId": null,
            "childId": 11,
            "op": "InsertBefore",
            "parentId": 10,
            "slotIndex": 0,
          },
          {
            "beforeId": 4,
            "childId": 10,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
        ]
      `);
    }
    // No unmount (reuse) will happen
    expect(log).toMatchInlineSnapshot(`
      [
        "mount CompB",
        "mount CompB-0",
        "mount CompB-1",
        "mount CompB-2",
      ]
    `);

    // Reverse transition (state 2 -> 1): slot 0 Fragment unmounts, slot 1 must
    // still NOT be touched. We expect exactly 3 unmounts from the Fragment
    // children and zero from slot 1.
    fireEvent.tap(getByTestId('view'));
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
    expect(log).toMatchInlineSnapshot(`
      [
        "mount CompB",
        "mount CompB-0",
        "mount CompB-1",
        "mount CompB-2",
        "unmount CompB-0",
        "unmount CompB-1",
        "unmount CompB-2",
      ]
    `);
  });
});

describe('should reuse dom', () => {
  it('keyed list reorder inside Fragment should still work', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    let setState;
    const App = () => {
      const [state, _setState] = useState(1);
      setState = _setState;
      const items = state === 1 ? ['a', 'b', 'c'] : ['c', 'a', 'b'];

      return (
        <view
          data-testid='view'
          bindtap={() => setState(state === 1 ? 2 : 1)}
        >
          {items.map(i => <text key={i}>{i}</text>)}
        </view>
      );
    };

    const { container, getByTestId } = render(<App />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <text>
            a
          </text>
          <text>
            b
          </text>
          <text>
            c
          </text>
        </view>
      </page>
    `);

    fireEvent.tap(getByTestId('view'));
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          data-testid="view"
        >
          <text>
            c
          </text>
          <text>
            a
          </text>
          <text>
            b
          </text>
        </view>
      </page>
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      const createOps = formattedSnapshotPatch.filter(p => p.op === 'CreateElement');
      // No new elements should be created on reorder
      expect(createOps).toEqual([]);
      expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
        [
          {
            "beforeId": 3,
            "childId": 7,
            "op": "InsertBefore",
            "parentId": 2,
            "slotIndex": 0,
          },
        ]
      `);
    }
  });

  it('slot 1 component hooks state must be preserved when slot 0 type changes', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');

    const Comp = () => <text>Comp</text>;

    const log = [];
    const Counter = ({ name }) => {
      const [count, setCount] = useState(0);

      useEffect(() => {
        log.push(`mount-${name}`);
        return () => log.push(`unmount-${name}`);
      }, []);

      return (
        <text
          data-testid={`counter-${name}`}
          bindtap={() => setCount(c => c + 1)}
        >
          {name}-{count}
        </text>
      );
    };

    let toggle;
    const App = () => {
      const [state, _setState] = useState(1);
      toggle = () => _setState(s => s === 1 ? 2 : 1);
      return (
        <view>
          <view
            data-testid='toggle'
            bindtap={toggle}
          />
          <view>
            {state === 1 ? <Comp /> : <Counter name='slot0' />}
            <text>---</text>
            <Counter name='slot1' />
          </view>
        </view>
      );
    };

    const { container, getByTestId } = render(<App />);
    // initial: slot 1 Counter at count=0
    expect(getByTestId('counter-slot1').textContent).toBe('slot1-0');

    // bump slot 1's Counter 3 times
    fireEvent.tap(getByTestId('counter-slot1'));
    fireEvent.tap(getByTestId('counter-slot1'));
    fireEvent.tap(getByTestId('counter-slot1'));
    expect(getByTestId('counter-slot1').textContent).toBe('slot1-3');
    expect(log).toMatchInlineSnapshot(`
      [
        "mount-slot1",
      ]
    `);

    // toggle: slot 0 becomes a fresh Counter, slot 1 must keep its state
    fireEvent.tap(getByTestId('toggle'));

    // If the bug returns: slot 0 would steal slot 1's instance and show
    // "slot0-3", while slot 1 would be a fresh "slot1-0".
    expect(getByTestId('counter-slot0').textContent).toBe('slot0-0');
    expect(getByTestId('counter-slot1').textContent).toBe('slot1-3');
    expect(log).toMatchInlineSnapshot(`
      [
        "mount-slot1",
        "mount-slot0",
      ]
    `);

    fireEvent.tap(getByTestId('toggle'));

    expect(log).toMatchInlineSnapshot(`
      [
        "mount-slot1",
        "mount-slot0",
        "unmount-slot0",
      ]
    `);

    fireEvent.tap(getByTestId('toggle'));
    expect(log).toMatchInlineSnapshot(`
      [
        "mount-slot1",
        "mount-slot0",
        "unmount-slot0",
        "mount-slot0",
      ]
    `);
  });
});
