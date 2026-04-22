import { Component, h, options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';
import { __root } from '../../../src/root';
import { injectLepusMethods } from '../../../src/snapshot/lynx/injectLepusMethods';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
  lynx.performance.__functionCallHistory = [];
});

describe('setState timing api', () => {
  it('basic', async function() {
    let comp;
    class Comp extends Component {
      state = {
        show: false,
      };
      render() {
        comp = this;
        return <view></view>;
      }
    }

    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);

    globalEnvManager.switchToMainThread();
    const snapshotId = __root.__id;

    expect(getUniqueIdListBySnapshotId({ snapshotId })).toMatchInlineSnapshot(`
      {
        "uniqueIdList": [
          0,
        ],
      }
    `);
    expect(getUniqueIdListBySnapshotId({ snapshotId: null })).toMatchInlineSnapshot(`null`);

    expect(
      getSnapshotIdByUniqueId({ uniqueId: 0 }),
    ).toMatchInlineSnapshot(`
      {
        "snapshotId": -1,
      }
    `);

    expect(
      getSnapshotIdByUniqueId({ uniqueId: 1 }),
    ).toMatchInlineSnapshot(`
      {
        "snapshotId": -2,
      }
    `);

    expect(
      getSnapshotIdByUniqueId({ uniqueId: 3 }),
    ).toMatchInlineSnapshot(`null`);
  });
});
