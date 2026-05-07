// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  GlobalCommitContext,
  markRemovedSubtreeForCurrentCommit,
  resetGlobalCommitContext,
  takeRemovedSubtreesForCurrentCommit,
} from '../../../../src/element-template/background/commit-context.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  collectElementTemplateSubtreeHandleIds,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';

describe('ElementTemplate commit context', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    resetGlobalCommitContext();
  });

  it('keeps removed subtree roots outside the update payload', () => {
    const root = new BackgroundElementTemplateInstance('view');

    markRemovedSubtreeForCurrentCommit(root);
    markRemovedSubtreeForCurrentCommit(root);

    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([root]);
    expect({
      ops: GlobalCommitContext.ops,
      flushOptions: GlobalCommitContext.flushOptions,
      flowIds: GlobalCommitContext.flowIds,
    }).not.toHaveProperty('removedSubtrees');
  });

  it('takes removed subtree roots from the current commit once', () => {
    const root = new BackgroundElementTemplateInstance('view');
    markRemovedSubtreeForCurrentCommit(root);

    expect(takeRemovedSubtreesForCurrentCommit()).toEqual([root]);
    expect(takeRemovedSubtreesForCurrentCommit()).toEqual([]);
  });

  it('clears non-payload state when the global commit context resets', () => {
    const root = new BackgroundElementTemplateInstance('view');
    markRemovedSubtreeForCurrentCommit(root);

    resetGlobalCommitContext();

    expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
  });

  it('collects only handles that are registered in the main-thread registry', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    root.appendChild(slot);
    const child = new BackgroundElementTemplateInstance('child');
    const childSlot = new BackgroundElementTemplateSlot();
    childSlot.setAttribute('id', 0);
    child.appendChild(childSlot);
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['text']);
    childSlot.appendChild(rawText);
    slot.appendChild(child);

    expect(collectElementTemplateSubtreeHandleIds(root)).toEqual([
      root.instanceId,
      child.instanceId,
      rawText.instanceId,
    ]);
  });
});
