// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MTSFlushOptions } from '@lynx-js/lynx-runtime';

export type CommitFlushOptions = MTSFlushOptions & {
  __lynx_timing_flag?: string | undefined;
};

export interface GlobalCommitContext<Ops = unknown[]> {
  ops: Ops;
  flushOptions: CommitFlushOptions;
  flowIds?: number[];
}

export const globalCommitContext: GlobalCommitContext = {
  ops: [],
  flushOptions: {},
};

export function resetGlobalCommitContext(): void {
  globalCommitContext.ops = [];
  globalCommitContext.flushOptions = {};
  delete globalCommitContext.flowIds;
}

export function takeGlobalFlushOptions(): CommitFlushOptions {
  const flushOptions = globalCommitContext.flushOptions;
  globalCommitContext.flushOptions = {};
  return flushOptions;
}
