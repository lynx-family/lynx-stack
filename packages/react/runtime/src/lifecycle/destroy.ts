// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';

import { __root } from '../root.js';
import { globalCommitTaskMap } from './patch/commit.js';

function destroyBackground(): void {
  if (__PROFILE__) {
    console.profile('destroyBackground');
  }

  render(null, __root as any);

  globalCommitTaskMap.forEach(task => {
    task();
  });
  globalCommitTaskMap.clear();

  if (__PROFILE__) {
    console.profileEnd();
  }
}

export { destroyBackground };
