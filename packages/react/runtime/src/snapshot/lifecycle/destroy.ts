// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';

import { __root } from '../../root.js';
import { delayedEvents } from './event/delayEvents.js';
import { delayedLifecycleEvents } from './event/delayLifecycleEvents.js';
import { globalCommitTaskMap } from './patch/commit.js';
import { setBackgroundDestroying } from './patch/globalState.js';
import { deinitGlobalSnapshotPatch } from './patch/snapshotPatch.js';
import { delayedUiOps } from './ref/delay.js';
import { takeMainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { withSyncEffectFlush } from '../../utils.js';
import { resetSnapshotMainThreadFunctionRuntime } from '../worklet/call/runOnMainThread.js';
import { resetSnapshotBackgroundFunctionRuntime } from '../worklet/ctx.js';

function destroyBackground(isHostDestroying = false): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::destroyBackground');
  }

  deinitGlobalSnapshotPatch();
  setBackgroundDestroying(isHostDestroying);

  try {
    withSyncEffectFlush(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      render(null, __root as any);
    });

    globalCommitTaskMap.forEach(task => {
      task();
    });
  } finally {
    // Reload keeps refs alive; only host destruction discards their pending sync.
    if (isHostDestroying) takeMainThreadRefInitValuePatch();
    setBackgroundDestroying(false);
    globalCommitTaskMap.clear();
    // Clear delayed events which should not be executed after destroyed.
    // This is important when the page is performing a reload.
    delayedLifecycleEvents.length = 0;
    if (delayedEvents) {
      delayedEvents.length = 0;
    }
    delayedUiOps.length = 0;
    resetSnapshotBackgroundFunctionRuntime();
    resetSnapshotMainThreadFunctionRuntime();
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }
}

export { destroyBackground };
