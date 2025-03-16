import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initGlobalSnapshotPatch } from '../src/lifecycle/patch/snapshotPatch';
import { injectUpdateMainThread } from '../src/lifecycle/patch/updateMainThread';
import { SnapshotInstance, setupPage } from '../src/snapshot';
import { globalEnvManager } from './utils/envManager';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});

beforeEach(() => {
  initGlobalSnapshotPatch();
  globalEnvManager.resetEnv();
  globalEnvManager.switchToMainThread();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const snapshot1 = __SNAPSHOT__(
  <view>
    <text text={HOLE}></text>
    <text text={HOLE}></text>
  </view>,
);

describe('updatePatch', () => {
  it('basic', async function() {
    const instance1 = new SnapshotInstance(snapshot1, 1);
    instance1.ensureElements();
    const patch = {
      data: JSON.stringify({
        snapshotPatch: [
          3,
          1,
          0,
          'attr 1',
          3,
          1,
          1,
          'attr 2',
        ],
      }),
      patchOptions: {
        commitId: 1,
      },
    };

    rLynxChange(patch);
    expect(instance1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text
          text="attr 1"
        />
        <text
          text="attr 2"
        />
      </view>
    `);
  });
});
