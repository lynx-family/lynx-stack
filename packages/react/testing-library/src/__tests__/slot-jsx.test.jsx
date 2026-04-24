import { expect } from 'vitest';
import { useState } from '@lynx-js/react';

import { fireEvent, render, act } from '..';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/snapshot/debug/formatPatch';
import { printSnapshotInstanceToString } from '../../../runtime/lib/snapshot/debug/printSnapshot';
import { __root } from '../../../runtime/lib/root';

// Spy on the main-thread element-PAPI mutation calls and return a snapshot-friendly
// trace of `op(parent, child[, ref])` lines. Each element is shown as `<tag>text</tag>`.
// Used to lock in the exact DOM operations a render produces so accidental redundant
// ops show up as a diff. (We spy directly on the PAPI globals rather than going
// through the existing `console.alog` trace, which would require dual-thread render
// + careful ordering against the runtime alog wrap.)
function spyElementApi() {
  const g = lynxTestingEnv.mainThread.globalThis;
  const desc = el => {
    if (el == null) return 'null';
    const tag = (el.tagName || 'raw').toLowerCase();
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return txt && txt.length <= 12 ? `<${tag}>${txt}</${tag}>` : `<${tag}>`;
  };
  const ops = [];
  const wrap = (name, formatter) => {
    const original = g[name];
    vi.spyOn(g, name).mockImplementation((...args) => {
      ops.push(formatter(args));
      return original.apply(g, args);
    });
  };
  wrap('__AppendElement', ([parent, child]) => `append(${desc(parent)} <- ${desc(child)})`);
  wrap(
    '__InsertElementBefore',
    ([parent, child, ref]) => `insertBefore(${desc(parent)}: ${desc(child)} before ${desc(ref)})`,
  );
  wrap('__RemoveElement', ([parent, child]) => `remove(${desc(parent)} -x ${desc(child)})`);
  wrap('__CreateElement', ([type]) => `create(${type})`);
  wrap('__CreateView', () => `create(view)`);
  wrap('__CreateText', () => `create(text)`);
  wrap('__CreateRawText', ([text]) => `create(raw-text "${text}")`);
  wrap('__CreateWrapperElement', () => `create(wrapper)`);
  let mark = 0;
  return {
    mark() {
      mark = ops.length;
    },
    trace() {
      return ops.slice(mark).join('\n');
    },
  };
}

test('setState changes jsx', async () => {
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

  const jsx0 = <text>Hello 0</text>;
  const jsx1 = <text>Hello 1</text>;
  const jsx2 = <text>Hello 2</text>;

  const Comp = () => {
    const [text0, setText0] = useState(jsx0);
    const [text1, setText1] = useState(jsx1);
    const handleTap = () => {
      setText0(jsx1);
      setText1(jsx0);
    };
    return (
      <view bindtap={handleTap} data-testid='view'>
        {text0}
        <text>---</text>
        {[0, 1, 2].map((i) => text1)}
        <text>---</text>
        {jsx2}
      </view>
    );
  };

  const { container, findByTestId } = render(<Comp />);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            Hello 0
          </text>
        </wrapper>
        <text>
          ---
        </text>
        <wrapper>
          <text>
            Hello 1
          </text>
          <text>
            Hello 1
          </text>
          <text>
            Hello 1
          </text>
        </wrapper>
        <text>
          ---
        </text>
        <wrapper>
          <text>
            Hello 2
          </text>
        </wrapper>
      </view>
    </page>
  `);

  {
    expect(callLepusMethodCalls.length).toBe(1);
    const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
    const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
      [
        {
          "id": 2,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_4",
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
          "type": "__snapshot_c1db7_test_1",
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
          "type": "__snapshot_c1db7_test_2",
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
          "type": "__snapshot_c1db7_test_2",
        },
        {
          "beforeId": null,
          "childId": 5,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 6,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_2",
        },
        {
          "beforeId": null,
          "childId": 6,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 7,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_3",
        },
        {
          "beforeId": null,
          "childId": 7,
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

  expect(__root.constructor.name).toMatchInlineSnapshot(`"BackgroundSnapshotInstance"`);
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_4): [null]
        | 3(__snapshot_c1db7_test_1): undefined
        | 4(__snapshot_c1db7_test_2): undefined
        | 5(__snapshot_c1db7_test_2): undefined
        | 6(__snapshot_c1db7_test_2): undefined
        | 7(__snapshot_c1db7_test_3): undefined"
  `);
  lynxTestingEnv.switchToMainThread();
  try {
    expect(__root.constructor.name).toMatchInlineSnapshot(`"SnapshotInstance"`);
    expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
      "| -1(root): undefined
        | 2(__snapshot_c1db7_test_4): ["2:0:"]
          | 3(__snapshot_c1db7_test_1): undefined
          | 4(__snapshot_c1db7_test_2): undefined
          | 5(__snapshot_c1db7_test_2): undefined
          | 6(__snapshot_c1db7_test_2): undefined
          | 7(__snapshot_c1db7_test_3): undefined"
    `);
  } finally {
    lynxTestingEnv.switchToBackgroundThread();
  }

  const view = await findByTestId('view');
  fireEvent.tap(view);

  {
    expect(callLepusMethodCalls.length).toBe(2);
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
          "id": 8,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_2",
        },
        {
          "beforeId": 4,
          "childId": 8,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 0,
        },
        {
          "childId": 4,
          "op": "RemoveChild",
          "parentId": 2,
        },
        {
          "childId": 5,
          "op": "RemoveChild",
          "parentId": 2,
        },
        {
          "childId": 6,
          "op": "RemoveChild",
          "parentId": 2,
        },
        {
          "id": 9,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_1",
        },
        {
          "beforeId": 7,
          "childId": 9,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 10,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_1",
        },
        {
          "beforeId": 7,
          "childId": 10,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 11,
          "op": "CreateElement",
          "type": "__snapshot_c1db7_test_1",
        },
        {
          "beforeId": 7,
          "childId": 11,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
      ]
    `);
  }

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            Hello 1
          </text>
        </wrapper>
        <text>
          ---
        </text>
        <wrapper>
          <text>
            Hello 0
          </text>
          <text>
            Hello 0
          </text>
          <text>
            Hello 0
          </text>
        </wrapper>
        <text>
          ---
        </text>
        <wrapper>
          <text>
            Hello 2
          </text>
        </wrapper>
      </view>
    </page>
  `);

  expect(__root.constructor.name).toMatchInlineSnapshot(`"BackgroundSnapshotInstance"`);
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_4): [null]
        | 8(__snapshot_c1db7_test_2): undefined
        | 9(__snapshot_c1db7_test_1): undefined
        | 10(__snapshot_c1db7_test_1): undefined
        | 11(__snapshot_c1db7_test_1): undefined
        | 7(__snapshot_c1db7_test_3): undefined"
  `);
  lynxTestingEnv.switchToMainThread();
  try {
    expect(__root.constructor.name).toMatchInlineSnapshot(`"SnapshotInstance"`);
    expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
      "| -1(root): undefined
        | 2(__snapshot_c1db7_test_4): ["2:0:"]
          | 8(__snapshot_c1db7_test_2): undefined
          | 9(__snapshot_c1db7_test_1): undefined
          | 10(__snapshot_c1db7_test_1): undefined
          | 11(__snapshot_c1db7_test_1): undefined
          | 7(__snapshot_c1db7_test_3): undefined"
    `);
  } finally {
    lynxTestingEnv.switchToBackgroundThread();
  }
});

test('cross-slot keyed move: E is placed before A with correct beforeId in patch', async () => {
  const tX = <text key='X'>X</text>;
  const tA = <text key='A'>A</text>;
  const tE = <text key='E'>E</text>;
  const tD = <text key='D'>D</text>;
  const tN = <text key='N'>N</text>;
  vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

  const Comp = () => {
    const [moved, setMoved] = useState(false);
    return (
      <view bindtap={() => setMoved(true)} data-testid='view'>
        {moved ? tE : tX}
        <text>-</text>
        {tA}
        <text>-</text>
        {moved ? tN : tE}
        <text>-</text>
        {tD}
      </view>
    );
  };

  const trace = spyElementApi();
  const { container, findByTestId } = render(<Comp />);
  const view = await findByTestId('view');
  trace.mark();
  fireEvent.tap(view);

  // Lock in the exact element-PAPI sequence so an extra DOM op shows up as a diff.
  expect(trace.trace()).toMatchInlineSnapshot(`
    "remove(<wrapper>X</wrapper> -x <text>X</text>)
    remove(<wrapper> -x <text>E</text>)
    append(<wrapper> <- <text>E</text>)
    create(text)
    create(raw-text "N")
    append(<text> <- <raw>N</raw>)
    append(<wrapper> <- <text>N</text>)"
  `);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            E
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            A
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            N
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            D
          </text>
        </wrapper>
      </view>
    </page>
  `);

  expect(callLepusMethodCalls.length).toBe(2);
  const patch = JSON.parse(callLepusMethodCalls[1][1]['data']).patchList[0].snapshotPatch;
  expect(prettyFormatSnapshotPatch(patch)).toMatchInlineSnapshot(`
    [
      {
        "childId": 3,
        "op": "RemoveChild",
        "parentId": 2,
      },
      {
        "beforeId": 4,
        "childId": 5,
        "op": "InsertBefore",
        "parentId": 2,
        "slotIndex": 0,
      },
      {
        "id": 7,
        "op": "CreateElement",
        "type": "__snapshot_c1db7_test_9",
      },
      {
        "beforeId": 6,
        "childId": 7,
        "op": "InsertBefore",
        "parentId": 2,
        "slotIndex": 2,
      },
    ]
  `);

  // Background tree: [E, A, N, D] in slot order.
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_10): [null]
        | 5(__snapshot_c1db7_test_7): undefined
        | 4(__snapshot_c1db7_test_6): undefined
        | 7(__snapshot_c1db7_test_9): undefined
        | 6(__snapshot_c1db7_test_8): undefined"
  `);
});

// Two keys move across slots simultaneously: H moves $0→$1, G moves $2→$3.
// Verifies background tree stays in slot order and main-thread container is correct.
test('multi-key cross-slot moves keep background snapshot tree in slot order', async () => {
  const ITEMS = {
    A: <text key='A'>A</text>,
    B: <text key='B'>B</text>,
    C: <text key='C'>C</text>,
    D: <text key='D'>D</text>,
    E: <text key='E'>E</text>,
    F: <text key='F'>F</text>,
    G: <text key='G'>G</text>,
    H: <text key='H'>H</text>,
  };

  const before = ['H', 'A', 'G', 'B'];
  const after = ['F', 'H', 'E', 'G'];

  let setMoved;
  const Comp = () => {
    const [moved, set] = useState(false);
    setMoved = set;
    const layout = moved ? after : before;
    return (
      <view data-testid='view'>
        {ITEMS[layout[0]]}
        <text>-</text>
        {ITEMS[layout[1]]}
        <text>-</text>
        {ITEMS[layout[2]]}
        <text>-</text>
        {ITEMS[layout[3]]}
      </view>
    );
  };

  const trace = spyElementApi();
  const { container } = render(<Comp />);

  const getViewChildCount = () => {
    const tree = printSnapshotInstanceToString(__root);
    return (tree.match(/^ {4}\| \d+\(/gm) ?? []).length;
  };

  expect(getViewChildCount()).toBe(4);

  trace.mark();
  act(() => setMoved(true));

  expect(trace.trace()).toMatchInlineSnapshot(`
    "remove(<wrapper>A</wrapper> -x <text>A</text>)
    remove(<wrapper>B</wrapper> -x <text>B</text>)
    create(text)
    create(raw-text "F")
    append(<text> <- <raw>F</raw>)
    insertBefore(<wrapper>H</wrapper>: <text>F</text> before <text>H</text>)
    remove(<wrapper> -x <text>H</text>)
    append(<wrapper> <- <text>H</text>)
    create(text)
    create(raw-text "E")
    append(<text> <- <raw>E</raw>)
    insertBefore(<wrapper>G</wrapper>: <text>E</text> before <text>G</text>)
    remove(<wrapper> -x <text>G</text>)
    append(<wrapper> <- <text>G</text>)"
  `);

  expect(getViewChildCount()).toBe(4);
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_19): undefined
        | 7(__snapshot_c1db7_test_16): undefined
        | 3(__snapshot_c1db7_test_18): undefined
        | 8(__snapshot_c1db7_test_15): undefined
        | 5(__snapshot_c1db7_test_17): undefined"
  `);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            F
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            H
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            E
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            G
          </text>
        </wrapper>
      </view>
    </page>
  `);
});

// Three keys cross slots in one render: F $0→$3, H $1→$0, plus E/G removed and A/D created.
// Each $N has its own wrapper element; an InsertBefore where `newNode` and the
// `existingNode` reference live in different slot wrappers can't go through
// `parent.insertBefore(node, ref)` (ref isn't a child of parent) and must fall
// back to appending into the new slot's wrapper.
test('three-key cross-slot move applies cleanly on main thread', async () => {
  const ITEMS = {
    A: <text key='A'>A</text>,
    D: <text key='D'>D</text>,
    E: <text key='E'>E</text>,
    F: <text key='F'>F</text>,
    G: <text key='G'>G</text>,
    H: <text key='H'>H</text>,
  };

  const before = ['F', 'H', 'E', 'G'];
  const after = ['H', 'A', 'D', 'F'];

  let setMoved;
  const Comp = () => {
    const [moved, set] = useState(false);
    setMoved = set;
    const layout = moved ? after : before;
    return (
      <view data-testid='view'>
        {ITEMS[layout[0]]}
        <text>-</text>
        {ITEMS[layout[1]]}
        <text>-</text>
        {ITEMS[layout[2]]}
        <text>-</text>
        {ITEMS[layout[3]]}
      </view>
    );
  };

  const trace = spyElementApi();
  const { container } = render(<Comp />);

  // Spy on element-API calls during the *update* (after initial render) so any
  // regression that adds redundant DOM ops to a cross-slot move is caught.
  trace.mark();
  act(() => setMoved(true));
  expect(trace.trace()).toMatchInlineSnapshot(`
    "remove(<wrapper>E</wrapper> -x <text>E</text>)
    remove(<wrapper>G</wrapper> -x <text>G</text>)
    remove(<wrapper>F</wrapper> -x <text>H</text>)
    insertBefore(<wrapper>F</wrapper>: <text>H</text> before <text>F</text>)
    create(text)
    create(raw-text "A")
    append(<text> <- <raw>A</raw>)
    append(<wrapper> <- <text>A</text>)
    create(text)
    create(raw-text "D")
    append(<text> <- <raw>D</raw>)
    append(<wrapper> <- <text>D</text>)
    remove(<wrapper> -x <text>F</text>)
    append(<wrapper> <- <text>F</text>)"
  `);

  // Container reflects the new layout end-to-end through the main-thread renderer.
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            H
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            A
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            D
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            F
          </text>
        </wrapper>
      </view>
    </page>
  `);
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_26): undefined
        | 4(__snapshot_c1db7_test_25): undefined
        | 7(__snapshot_c1db7_test_20): undefined
        | 8(__snapshot_c1db7_test_21): undefined
        | 3(__snapshot_c1db7_test_23): undefined"
  `);
});

// Mixing a single-VNode slot with an array slot: cross-slot keyed move from a
// view-level VNode (slot 0) into an array slot (slot 1) does NOT happen because
// arrays in JSX become Fragments with their own diff context. preact unmounts the
// view-level `b` and creates a fresh one inside the Fragment — verified here so
// the assumption is recorded.
test('array slot isolates diff context: keyed VNode is recreated, not cross-slot reused', async () => {
  const tA = <text key='A'>A</text>;
  const tb = <text key='b'>b</text>;
  const tx = <text key='x'>x</text>;
  let setMoved;
  const Comp = () => {
    const [moved, set] = useState(false);
    setMoved = set;
    return (
      <view data-testid='view'>
        {moved ? null : tb}
        <text>-</text>
        {moved ? [tA, tb, tx] : [tx]}
      </view>
    );
  };

  const trace = spyElementApi();
  const { container } = render(<Comp />);
  trace.mark();
  act(() => setMoved(true));

  // No cross-wrapper insertBefore: b is unmounted from slot 0 and a fresh b is
  // created and inserted via same-slot insertBefore inside slot 1's Fragment.
  expect(trace.trace()).toMatchInlineSnapshot(`
    "remove(<wrapper>b</wrapper> -x <text>b</text>)
    create(text)
    create(raw-text "A")
    append(<text> <- <raw>A</raw>)
    insertBefore(<wrapper>x</wrapper>: <text>A</text> before <text>x</text>)
    create(text)
    create(raw-text "b")
    append(<text> <- <raw>b</raw>)
    insertBefore(<wrapper>Ax</wrapper>: <text>b</text> before <text>x</text>)"
  `);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper />
        <text>
          -
        </text>
        <wrapper>
          <text>
            A
          </text>
          <text>
            b
          </text>
          <text>
            x
          </text>
        </wrapper>
      </view>
    </page>
  `);
});

// Two view-level single-VNode slots swap their content via cross-slot keyed reuse.
// This is the *only* shape where a cross-slot keyed move can happen in SlotV2;
// each slot still ends up with at most one child, so the cross-wrapper insertBefore
// fallback (`__AppendElement`) is correct (no intra-slot ordering to violate).
test('cross-slot keyed swap between two single-VNode slots', async () => {
  const tA = <text key='A'>A</text>;
  const tB = <text key='B'>B</text>;
  let setSwap;
  const Comp = () => {
    const [swap, set] = useState(false);
    setSwap = set;
    return (
      <view data-testid='view'>
        {swap ? tB : tA}
        <text>-</text>
        {swap ? tA : tB}
      </view>
    );
  };

  const trace = spyElementApi();
  const { container } = render(<Comp />);
  trace.mark();
  act(() => setSwap(true));

  expect(trace.trace()).toMatchInlineSnapshot(`
    "remove(<wrapper>A</wrapper> -x <text>B</text>)
    insertBefore(<wrapper>A</wrapper>: <text>B</text> before <text>A</text>)
    remove(<wrapper> -x <text>A</text>)
    append(<wrapper> <- <text>A</text>)"
  `);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <wrapper>
          <text>
            B
          </text>
        </wrapper>
        <text>
          -
        </text>
        <wrapper>
          <text>
            A
          </text>
        </wrapper>
      </view>
    </page>
  `);
});

// Random slot-layout transitions driven end-to-end through the main-thread renderer.
// Runs both keyed (cross-slot reuse possible) and unkeyed (positional only) variants
// to cover both diff paths. Mirrors the property-based fuzz in internal-preact
// (SLOT_COUNT=6, STEPS=10000).
function runSlotFuzz({ withKey, seed: initialSeed }) {
  const ALL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const ITEMS = withKey
    ? Object.fromEntries(ALL.map(k => [k, <text key={k}>{k}</text>]))
    : Object.fromEntries(ALL.map(k => [k, <text>{k}</text>]));

  const SLOT_COUNT = 6;
  const STEPS = 10000;
  let seed = initialSeed >>> 0;
  const rand = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };
  const pickLayout = () => {
    const pool = ALL.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SLOT_COUNT);
  };

  const layouts = [];
  for (let i = 0; i < STEPS; i++) layouts.push(pickLayout());

  let step = 0;
  let setStep = null;
  const Comp = () => {
    const [s, setS] = useState(0);
    setStep = setS;
    const layout = layouts[s];
    return (
      <view data-testid='view'>
        {ITEMS[layout[0]]}
        <text>-</text>
        {ITEMS[layout[1]]}
        <text>-</text>
        {ITEMS[layout[2]]}
        <text>-</text>
        {ITEMS[layout[3]]}
        <text>-</text>
        {ITEMS[layout[4]]}
        <text>-</text>
        {ITEMS[layout[5]]}
      </view>
    );
  };

  const { container } = render(<Comp />);
  const slotOrder = () =>
    Array.from(container.querySelectorAll('view > wrapper'))
      .map(w => w.textContent.trim());

  expect(slotOrder()).toEqual(layouts[0]);
  for (step = 1; step < STEPS; step++) {
    expect(slotOrder()).toEqual(layouts[step - 1]);
    act(() => {
      setStep(step);
    });
    expect(slotOrder()).toEqual(layouts[step]);
  }
}

test('fuzz (keyed): cross-slot keyed moves keep slot order', { timeout: 30000 }, () => {
  runSlotFuzz({ withKey: true, seed: 0xDEADBEEF });
});

test('fuzz (unkeyed): positional slot updates keep slot order', { timeout: 30000 }, () => {
  // Different seed so we exercise a different sequence than the keyed variant.
  runSlotFuzz({ withKey: false, seed: 0x1337C0DE });
});
