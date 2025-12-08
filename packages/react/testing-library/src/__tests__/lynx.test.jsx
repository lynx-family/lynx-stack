import { describe, expect, it, vi } from 'vitest';
import { render } from '..';
import {
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  SnapshotOperation,
} from '../../../runtime/lib/lifecycle/patch/snapshotPatch';
import { prettyFormatSnapshotPatch } from '../../../runtime/lib/debug/formatPatch';

describe('lynx global API', () => {
  it('getJSModule should work', () => {
    const cb = vi.fn();
    lynx.getJSModule('GlobalEventEmitter')
      .addListener('onDataChanged', cb);

    lynx.getJSModule('GlobalEventEmitter').emit('onDataChanged', [{
      data: {
        foo: 'bar',
      },
    }]);
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "foo": "bar",
            },
          },
        ],
      ]
    `);
  });
  it('background ctxNotFoundEventListener works', () => {
    const oldCallLepusMethod = lynx.getNativeApp().callLepusMethod;
    vi.spyOn(lynx.getNativeApp(), 'callLepusMethod').mockImplementation((...args) => {
      if (args[0] === 'rLynxChange' && args[1].patchOptions.isHydration) {
        const data = JSON.parse(args[1].data);
        data.patchList[0].snapshotPatch.push(
          SnapshotOperation.InsertBefore,
          1e10,
          1e10,
          null,
        );
        args[1].data = JSON.stringify(data);
      }
      oldCallLepusMethod(...args);
    });
    const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

    vi.spyOn(lynxTestingEnv.backgroundThread.lynx, 'reportError');
    const reportErrorCalls = lynxTestingEnv.backgroundThread.lynx.reportError.mock.calls;

    expect(() => render(<view />)).toThrowErrorMatchingInlineSnapshot(
      `[Error: snapshotPatchApply failed: ctx not found, snapshot type: 'null']`,
    );

    const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
    const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
    expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
      [
        {
          "id": 2,
          "op": "CreateElement",
          "type": "__snapshot_d4b6f_test_1",
        },
        {
          "beforeId": null,
          "childId": 2,
          "op": "InsertBefore",
          "parentId": -1,
        },
        {
          "beforeId": null,
          "childId": 10000000000,
          "op": "InsertBefore",
          "parentId": 10000000000,
        },
      ]
    `);
  });
});
