// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BackgroundElementTemplateInstance } from './instance.js';
import type { ElementTemplateUpdateCommitContext } from '../protocol/types.js';

interface ElementTemplateCommitNonPayloadState {
  // Background-only JS objects must not be included in the cross-thread update
  // payload. They ride alongside the payload until the dispatch boundary
  // schedules delayed teardown.
  removedSubtreesAwaitingTeardown: BackgroundElementTemplateInstance[];
}

type ElementTemplateGlobalCommitContext = ElementTemplateUpdateCommitContext & {
  nonPayload: ElementTemplateCommitNonPayloadState;
};

export const globalCommitContext: ElementTemplateGlobalCommitContext = {
  ops: [],
  flushOptions: {},
  nonPayload: {
    removedSubtreesAwaitingTeardown: [],
  },
};

export function resetGlobalCommitContext(): void {
  globalCommitContext.ops = [];
  globalCommitContext.flushOptions = {};
  delete globalCommitContext.flowIds;
  globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown = [];
}

export function markInitDataUpdatedForCurrentCommit(): void {
  globalCommitContext.flushOptions.triggerDataUpdated = true;
}

export function markRemovedSubtreeForPostDispatchTeardown(
  root: BackgroundElementTemplateInstance,
): void {
  const { removedSubtreesAwaitingTeardown } = globalCommitContext.nonPayload;
  if (!removedSubtreesAwaitingTeardown.includes(root)) {
    removedSubtreesAwaitingTeardown.push(root);
  }
}

export function takeRemovedSubtreesForPostDispatchTeardown(): BackgroundElementTemplateInstance[] {
  const removedSubtreesAwaitingTeardown = globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown;
  globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown = [];
  return removedSubtreesAwaitingTeardown;
}
