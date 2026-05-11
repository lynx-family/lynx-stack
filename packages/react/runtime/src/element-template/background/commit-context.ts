// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BackgroundElementTemplateInstance } from './instance.js';
import type { ElementTemplateUpdateCommitContext } from '../protocol/types.js';

interface ElementTemplateCommitNonPayloadState {
  // Background-only JS objects must not be included in the cross-thread update
  // payload. They ride alongside the payload until dispatch schedules cleanup.
  removedSubtrees: BackgroundElementTemplateInstance[];
}

type ElementTemplateGlobalCommitContext = ElementTemplateUpdateCommitContext & {
  nonPayload: ElementTemplateCommitNonPayloadState;
};

export const globalCommitContext: ElementTemplateGlobalCommitContext = {
  ops: [],
  flushOptions: {},
  nonPayload: {
    removedSubtrees: [],
  },
};

export function resetGlobalCommitContext(): void {
  globalCommitContext.ops = [];
  globalCommitContext.flushOptions = {};
  delete globalCommitContext.flowIds;
  globalCommitContext.nonPayload.removedSubtrees = [];
}

export function markRemovedSubtreeForCurrentCommit(
  root: BackgroundElementTemplateInstance,
): void {
  const { removedSubtrees } = globalCommitContext.nonPayload;
  if (!removedSubtrees.includes(root)) {
    removedSubtrees.push(root);
  }
}

export function takeRemovedSubtreesForCurrentCommit(): BackgroundElementTemplateInstance[] {
  const removedSubtrees = globalCommitContext.nonPayload.removedSubtrees;
  globalCommitContext.nonPayload.removedSubtrees = [];
  return removedSubtrees;
}
