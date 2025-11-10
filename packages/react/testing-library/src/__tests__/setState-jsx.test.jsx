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

  const Comp = () => {
    const [text0, setText0] = useState(jsx0);
    const [text1, setText1] = useState(jsx1);
    const hanldeTap = () => {
      setText0(jsx1);
      setText1(jsx0);
    };
    return (
      <view bindtap={hanldeTap} data-testid='view'>
        {text0}
        <text>---</text>
        {text1}
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
        </wrapper>
      </view>
    </page>
  `);

  const view = await findByTestId('view');
  debugger;
  try {
    fireEvent.tap(view);
  } catch (e) {
    console.log('e', e);
  }

  {
    const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
    const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
      [
        {
          "id": 2,
          "op": "CreateElement",
          "type": "__Card__:__snapshot_cd8d7_test_3",
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
          "beforeId": null,
          "childId": 4,
          "op": "InsertBefore",
          "parentId": 2,
          "slotIndex": 0,
        },
        {
          "beforeId": null,
          "childId": 3,
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
        </wrapper>
      </view>
    </page>
  `);
});
