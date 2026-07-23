// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';

import { getCurrentRootContext } from '../../root-context.js';
import { __root } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';

function destroyBackground(): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::destroyBackground');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  render(null, __root as any);

  const ctx = getCurrentRootContext();
  ctx.commitTaskMap.forEach(task => {
    task();
  });
  ctx.commitTaskMap.clear();
  // Clear delayed events which should not be executed after destroyed.
  // This is important when the page is performing a reload.
  ctx.delayedLifecycleEvents.length = 0;
  if (ctx.delayedEvents) {
    ctx.delayedEvents.length = 0;
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

export { destroyBackground };
