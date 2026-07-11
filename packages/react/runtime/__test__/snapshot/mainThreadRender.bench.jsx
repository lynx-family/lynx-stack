// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, bench, describe } from 'vitest';

import { root } from '../../src/lynx-api';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';

const FEED_SIZE = 200;

function App() {
  return (
    <view>
      {Array.from({ length: FEED_SIZE }).map((_, i) => (
        <view>
          <text>{`Feed item ${i}`}</text>
          <text>{`Description of feed item ${i}`}</text>
        </view>
      ))}
    </view>
  );
}

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

async function dualThreadStartup(mainThreadRender) {
  globalEnvManager.resetEnv();
  elementTree.clear();
  globalThis.__OnLifecycleEvent.mockClear();
  lynx.getNativeApp().callLepusMethod.mockClear();
  globalThis.__MAIN_THREAD_RENDER__ = mainThreadRender;

  try {
    // main-thread first-screen render
    __root.__jsx = <App />;
    renderPage();

    // background render
    globalEnvManager.switchToBackground();
    root.render(<App />);

    // hydrate (LifecycleConstant.firstScreen)
    lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

    // apply the hydration patch on the main thread (rLynxChange)
    globalEnvManager.switchToMainThread();
    const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
    globalThis[rLynxChange[0]](rLynxChange[1]);
    rLynxChange[2]();
    await waitSchedule();
  } finally {
    globalThis.__MAIN_THREAD_RENDER__ = true;
  }
}

describe('dual-thread startup (first screen + hydration)', () => {
  bench(`startup with ${FEED_SIZE}-item tree (mainThreadRender: true)`, async () => {
    await dualThreadStartup(true);
  });

  bench(`startup with ${FEED_SIZE}-item tree (mainThreadRender: false)`, async () => {
    await dualThreadStartup(false);
  });
});
