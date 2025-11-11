import { expect } from 'vitest';
import { Component, useState } from '@lynx-js/react';

import { fireEvent, render, act } from '..';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/debug/formatPatch';

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

  const view = await findByTestId('view');
  fireEvent.tap(view);

  {
    const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
    const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
      [
        {
          "id": 2,
          "op": "CreateElement",
          "type": "__Card__:__snapshot_cd8d7_test_4",
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
          "type": "__Card__:__snapshot_cd8d7_test_1",
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
          "type": "__Card__:__snapshot_cd8d7_test_2",
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
          "type": "__Card__:__snapshot_cd8d7_test_2",
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
          "type": "__Card__:__snapshot_cd8d7_test_2",
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
          "type": "__Card__:__snapshot_cd8d7_test_3",
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
          "id": 8,
          "op": "CreateElement",
          "type": "__Card__:__snapshot_cd8d7_test_2",
        },
        {
          "beforeId": null,
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
          "type": "__Card__:__snapshot_cd8d7_test_1",
        },
        {
          "beforeId": null,
          "childId": 9,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 10,
          "op": "CreateElement",
          "type": "__Card__:__snapshot_cd8d7_test_1",
        },
        {
          "beforeId": null,
          "childId": 10,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "id": 11,
          "op": "CreateElement",
          "type": "__Card__:__snapshot_cd8d7_test_1",
        },
        {
          "beforeId": null,
          "childId": 11,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 1,
        },
        {
          "beforeId": null,
          "childId": 7,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 2,
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
});
