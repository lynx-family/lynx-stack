// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { initTimingAPI as initCoreTimingAPI } from '../../core/performance.js';
import { globalCommitContext } from '../background/commit-context.js';

function shouldStartUpdatePipeline(): boolean {
  return globalCommitContext.ops.length > 0;
}

function initTimingAPI(): void {
  initCoreTimingAPI({
    shouldStartUpdatePipeline,
  });
}

/**
 * @internal
 */
export { initTimingAPI };
