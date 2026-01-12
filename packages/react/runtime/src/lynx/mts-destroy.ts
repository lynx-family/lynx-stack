// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __root } from '../root.js';
import type { SnapshotInstance } from '../snapshot.js';
import { isSdkVersionGt } from '../utils.js';

export function registerDestroyMts(): void {
  if (!isSdkVersionGt(3, 3)) {
    return;
  }
  lynx.getNative().addEventListener('__DestroyLifetime', destroyMts);
}

function destroyMts(): void {
  lynx.performance.profileStart('ReactLynx::destroyMts');
  const root = __root as SnapshotInstance;
  root.childNodes.forEach(child => root.removeChild(child));
  lynx.performance.profileEnd();
  lynx.getNative().removeEventListener('__DestroyLifetime', destroyMts);
}
