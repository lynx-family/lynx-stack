import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { render, fireEvent } from '..';
import { expect } from 'vitest';
import { useState } from 'preact/hooks';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/debug/formatPatch';

describe('should only render text when it is not empty', () => {
  it('empty text should not be rendered', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const { container } = render(
      <view>
        <text></text>
        <text>{''}</text>
        <text>Static Text</text>
      </view>,
      {
        enableMainThread: true,
        enableBackground: true,
      },
    );

    expect(JSON.stringify(JSON.parse(onLifecycleEventCalls[0][0][1]['root']), null, 2)).toMatchInlineSnapshot(`
      "{
        "id": -1,
        "type": "root",
        "children": [
          {
            "id": -2,
            "type": "__snapshot_89850_test_1",
            "__slotIndex": 0
          }
        ]
      }"
    `);
    expect(callLepusMethodCalls[0]).toMatchInlineSnapshot(`
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
      ]
    `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch.length).toBe(0);
    }
  });
  it('non-empty text should be rendered', () => {
    vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
    const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    const { container } = render(
      <view>
        <text></text>
        <text>{'Dynamic Text'}</text>
        <text>Static Text</text>
      </view>,
      {
        enableMainThread: true,
        enableBackground: true,
      },
    );

    expect(JSON.stringify(JSON.parse(onLifecycleEventCalls[0][0][1]['root']), null, 2)).toMatchInlineSnapshot(`
    "{
      "id": -1,
      "type": "root",
      "children": [
        {
          "id": -2,
          "type": "__snapshot_89850_test_2",
          "children": [
            {
              "id": -3,
              "type": null,
              "values": [
                "Dynamic Text"
              ],
              "__slotIndex": 0
            }
          ],
          "__slotIndex": 0
        }
      ]
    }"
  `);
    expect(callLepusMethodCalls[0]).toMatchInlineSnapshot(`
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
    ]
  `);
    {
      const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
      const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
      expect(formattedSnapshotPatch.length).toBe(0);
    }
  });
});
