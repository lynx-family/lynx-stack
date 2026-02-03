import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from '../../src/index';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

function getSnapshotPatchFromPatchUpdateCall(call) {
  const obj = call[1];
  const parsed = JSON.parse(obj.data);
  return parsed.patchList?.[0]?.snapshotPatch;
}

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('Patch size / execId churn', () => {
  it('MTF: stable ctx reference should not generate snapshotPatch', async function() {
    const mtf = {
      _wkltId: '835d:450ef:stable',
    };

    let bump_;
    function Comp() {
      const [, setTick] = useState(0);
      bump_ = () => {
        setTick(v => v + 1);
      };
      return (
        <view>
          <text main-thread:bindtap={mtf}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // rerender with no semantic changes
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      bump_();
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      expect(getSnapshotPatchFromPatchUpdateCall(rLynxChange)).toBeUndefined();
    }
  });

  it('spread: stable semantics should not generate snapshotPatch', async function() {
    let bump_;
    function Comp() {
      const [, setTick] = useState(0);
      bump_ = () => {
        setTick(v => v + 1);
      };
      // Simulate typical compiled output: a fresh ctx object each render.
      // `_wkltId` stays the same, but runtime injects `_execId`, causing patch churn.
      const spread = {
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:stable',
        },
      };
      return (
        <view>
          <text {...spread}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // rerender with no semantic changes
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      bump_();
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      expect(getSnapshotPatchFromPatchUpdateCall(rLynxChange)).toBeUndefined();
    }
  });

  it('gesture: stable gesture reference should not generate snapshotPatch', async function() {
    const stableGesture = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:stable',
        },
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };

    function Comp(_props) {
      return (
        <view>
          <text main-thread:gesture={stableGesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp tick={0} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp tick={0} />, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // rerender with no semantic changes
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp tick={1} />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      expect(getSnapshotPatchFromPatchUpdateCall(rLynxChange)).toBeUndefined();
    }
  });
});
