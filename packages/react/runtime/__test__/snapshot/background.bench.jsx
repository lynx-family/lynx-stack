// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, bench, describe } from 'vitest';

import { Background } from '../../src/core/background';
import { root } from '../../src/lynx-api';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';

const FEED_SIZE = 200;

function Feed() {
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

function Baseline() {
  return (
    <view>
      <Feed />
    </view>
  );
}

function Boundary() {
  return (
    <view>
      <Background fallback={<text>Loading…</text>}>
        <Feed />
      </Background>
    </view>
  );
}

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

function resetIteration() {
  globalEnvManager.resetEnv();
  elementTree.clear();
  globalThis.__OnLifecycleEvent.mockClear();
  lynx.getNativeApp().callLepusMethod.mockClear();
}

function renderFirstScreen(jsx) {
  __root.__jsx = jsx;
  renderPage();
}

async function dualThreadStartup(makeJsx) {
  resetIteration();

  // main-thread first-screen render (IFR)
  renderFirstScreen(makeJsx());

  // background render
  globalEnvManager.switchToBackground();
  root.render(makeJsx());

  // hydrate (LifecycleConstant.firstScreen)
  lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

  // apply the hydration patch on the main thread (rLynxChange)
  globalEnvManager.switchToMainThread();
  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
  globalThis[rLynxChange[0]](rLynxChange[1]);
  rLynxChange[2]();
  await waitSchedule();
}

describe('main-thread first-screen render (IFR)', () => {
  bench(`render ${FEED_SIZE}-item subtree (baseline)`, () => {
    resetIteration();
    renderFirstScreen(<Baseline />);
  });

  bench(`render ${FEED_SIZE}-item subtree behind <Background>`, () => {
    resetIteration();
    renderFirstScreen(<Boundary />);
  });
});

describe('dual-thread startup (first screen + hydration)', () => {
  bench(`startup with ${FEED_SIZE}-item subtree (baseline)`, async () => {
    await dualThreadStartup(() => <Baseline />);
  });

  bench(`startup with ${FEED_SIZE}-item subtree behind <Background>`, async () => {
    await dualThreadStartup(() => <Boundary />);
  });
});
