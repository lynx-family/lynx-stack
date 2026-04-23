import { expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';

import { fireEvent, render, act } from '..';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/snapshot/debug/formatPatch';
import { printSnapshotInstanceToString } from '../../../runtime/lib/snapshot/debug/printSnapshot';
import { __root } from '../../../runtime/lib/root';

test('setState changes jsx', async () => {
  vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
  const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
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
  lynxTestingEnv.switchToBackgroundThread();

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
  lynxTestingEnv.switchToBackgroundThread();
});

test('cross-slot keyed move emits wrong beforeId in patch (slot-branch null fallback)', async () => {
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

  const { container, findByTestId } = render(<Comp />);
  const view = await findByTestId('view');
  fireEvent.tap(view);

  // SlotV2 uses slotIndex not beforeId, so the wrong anchor doesn't surface in the container.
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

  // Bug: E moves to slot 0 but InsertBefore carries `beforeId: null` instead of A's id.
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
        "beforeId": null,
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

  // Background tree: wrong order (E appended past D); after fix will show [E, A, N, D].
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot(`
    "| -1(root): undefined
      | 2(__snapshot_c1db7_test_10): [null]
        | 4(__snapshot_c1db7_test_6): undefined
        | 7(__snapshot_c1db7_test_9): undefined
        | 6(__snapshot_c1db7_test_8): undefined
        | 5(__snapshot_c1db7_test_7): undefined"
  `);
});

// Two keys move across slots simultaneously; buggy preact appends them past stable siblings.
// Stays background-only: the buggy patches cause a linked-list cycle → OOM on main thread.
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

  // Intercept before main thread to prevent OOM from the linked-list cycle the bug creates.
  const patches = [];
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod').mockImplementation(
    (_name, data) => {
      patches.push(data);
    },
  );

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

  render(<Comp />);

  const getViewChildCount = () => {
    const tree = printSnapshotInstanceToString(__root);
    return (tree.match(/^ {4}\| \d+\(/gm) ?? []).length;
  };

  expect(getViewChildCount()).toBe(4); // H A G B

  act(() => setMoved(true));

  // Bug: some children are dropped/double-inserted, leaving fewer than 4 in the linked list.
  expect(getViewChildCount()).toBe(4);

  // Every InsertBefore at slotIndex < max must carry a real beforeId (not null).
  expect(patches.length).toBe(2);
  const updateOps = JSON.parse(patches[1]['data']).patchList[0].snapshotPatch;
  const insertOps = (updateOps ?? []).filter(
    o => o && o.op === 'InsertBefore' && o.parentId !== -1,
  );
  const maxSlotInPatch = Math.max(-1, ...insertOps.map(o => o.slotIndex ?? 0));
  const badOp = insertOps.find(
    o => o.beforeId == null && (o.slotIndex ?? 0) < maxSlotInPatch,
  );
  expect(badOp, `null beforeId at slotIndex ${badOp?.slotIndex} < max ${maxSlotInPatch}`).toBeUndefined();

  // After fix: [F, H, E, G] in slot order.
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot();
});

// Fuzz background-only: verifies no spurious `beforeId: null` on InsertBefore ops that have
// a later sibling in a higher-indexed slot. Never touches main thread (avoids linked-list OOM).
test('fuzz: update patches have no spurious null beforeId when later slot siblings exist', async () => {
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

  vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
  // Intercept before main thread to prevent linked-list OOM from buggy patches.
  const patches = [];
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod').mockImplementation(
    (_name, data) => {
      patches.push(data);
    },
  );

  const KEYS = Object.keys(ITEMS);
  const SLOT_COUNT = 4;
  const STEPS = 200;
  let seed = 0xDEADBEEF >>> 0;
  const rand = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };
  const pickLayout = () => {
    const pool = KEYS.slice();
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
      </view>
    );
  };

  render(<Comp />);

  const childCount = () => {
    const tree = printSnapshotInstanceToString(__root);
    return (tree.match(/^ {4}\| \d+\(/gm) ?? []).length;
  };

  let failure = null;
  for (step = 1; step < STEPS && !failure; step++) {
    act(() => {
      setStep(step);
    });
    const count = childCount();
    if (count !== SLOT_COUNT) {
      failure = `step=${step}`
        + `\n  prev=${JSON.stringify(layouts[step - 1])}`
        + `\n  next=${JSON.stringify(layouts[step])}`
        + `\n  want child count=${SLOT_COUNT}, got=${count}`
        + `\n  tree=${printSnapshotInstanceToString(__root)}`;
    }
  }
  if (failure) throw new Error(failure);

  // After fix: final layout in correct slot order.
  expect(printSnapshotInstanceToString(__root)).toMatchInlineSnapshot();
});
