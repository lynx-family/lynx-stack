// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';

import { destroyBackground } from './destroy.js';
import { shouldDelayUiOps } from './ref/delay.js';
import { canReEvalBackgroundEntry, reEvalBackgroundEntry } from '../../core/entry-reload.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { __root } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';

function reloadBackground(updateData: Record<string, any>, options?: Record<string, unknown>): void {
  if (canReEvalBackgroundEntry()) {
    reEvalBackgroundEntry(updateData, options, () => {
      // A queued `updateGlobalProps` callback must not render it again.
      __root.__jsx = undefined;
    });
    return;
  }

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadBackground');
  }

  destroyBackground();

  increaseReloadVersion();

  // COW when modify `lynx.__initData` to make sure Provider & Consumer works
  lynx.__initData = Object.assign({}, lynx.__initData, updateData);

  shouldDelayUiOps.value = true;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  render(__root.__jsx, __root as any);

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

export { reloadBackground };
