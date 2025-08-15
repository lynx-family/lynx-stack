// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';

import { __root } from '../root.js';
import { delayedEvents } from './event/delayEvents.js';
import { delayedLifecycleEvents } from './event/delayLifecycleEvents.js';
import { globalCommitTaskMap } from './patch/commit.js';
import { profileEnd, profileStart } from '../debug/utils.js';

function destroyBackground(): void {
  if (__PROFILE__) {
    profileStart('ReactLynx::destroyBackground');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  render(null, __root as any);

  globalCommitTaskMap.forEach(task => {
    task();
  });
  globalCommitTaskMap.clear();
  // Clear delayed events which should not be executed after destroyed.
  // This is important when the page is performing a reload.
  delayedLifecycleEvents.length = 0;
  if (delayedEvents) {
    delayedEvents.length = 0;
  }
  if (__PROFILE__) {
    profileEnd();
  }
}

export { destroyBackground };
