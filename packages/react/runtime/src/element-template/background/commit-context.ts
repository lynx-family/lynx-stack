// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BackgroundElementTemplateInstance } from './instance.js';
import {
  globalCommitContext as coreGlobalCommitContext,
  resetGlobalCommitContext as resetCoreGlobalCommitContext,
} from '../../core/commit-context.js';
import type { ElementTemplateUpdateCommitContext } from '../protocol/types.js';

interface ElementTemplateCommitNonPayloadState {
  // Background-only JS objects must not be included in the cross-thread update
  // payload. They ride alongside the payload until the dispatch boundary
  // schedules delayed cleanup.
  removedSubtreesAwaitingTeardown: BackgroundElementTemplateInstance[];
}

type ElementTemplateGlobalCommitContext = ElementTemplateUpdateCommitContext & {
  nonPayload: ElementTemplateCommitNonPayloadState;
};

const nonPayload: ElementTemplateCommitNonPayloadState = {
  removedSubtreesAwaitingTeardown: [],
};

export const globalCommitContext = coreGlobalCommitContext as unknown as ElementTemplateGlobalCommitContext;

globalCommitContext.nonPayload = nonPayload;

export function resetGlobalCommitContext(): void {
  resetCoreGlobalCommitContext();
  nonPayload.removedSubtreesAwaitingTeardown = [];
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
