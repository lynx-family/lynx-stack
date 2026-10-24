// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  globalCommitContext,
  markRemovedSubtreeForPostDispatchTeardown,
  resetGlobalCommitContext,
  takeRemovedSubtreesForPostDispatchTeardown,
} from '../../../../src/element-template/background/commit-context.js';
import {
  BackgroundElementTemplateInstance,
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

    markRemovedSubtreeForPostDispatchTeardown(root);
    markRemovedSubtreeForPostDispatchTeardown(root);

    expect([...globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown]).toEqual([root]);
    expect({
      ops: globalCommitContext.ops,
      flushOptions: globalCommitContext.flushOptions,
      flowIds: globalCommitContext.flowIds,
    }).not.toHaveProperty('removedSubtreesAwaitingTeardown');
  });

  it('takes removed subtree roots from the current commit once', () => {
    const root = new BackgroundElementTemplateInstance('view');
    markRemovedSubtreeForPostDispatchTeardown(root);

    expect(takeRemovedSubtreesForPostDispatchTeardown()).toEqual([root]);
    expect(takeRemovedSubtreesForPostDispatchTeardown()).toEqual([]);
  });

  it('clears non-payload state when the global commit context resets', () => {
    const root = new BackgroundElementTemplateInstance('view');
    markRemovedSubtreeForPostDispatchTeardown(root);

    resetGlobalCommitContext();

    expect([...globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown]).toEqual([]);
  });

  it('deduplicates a removal batch in first-seen order and keeps dispatched batches independent', () => {
    const roots = Array.from({ length: 512 }, () => new BackgroundElementTemplateInstance('view'));
    for (const root of roots) {
      markRemovedSubtreeForPostDispatchTeardown(root);
    }
    for (let i = roots.length - 1; i >= 0; i -= 1) {
      markRemovedSubtreeForPostDispatchTeardown(roots[i]!);
    }
    const dispatched = takeRemovedSubtreesForPostDispatchTeardown();
    expect(dispatched).toEqual(roots);

    markRemovedSubtreeForPostDispatchTeardown(roots[0]!);
    resetGlobalCommitContext();
    expect(takeRemovedSubtreesForPostDispatchTeardown()).toEqual([]);
    expect(dispatched).toEqual(roots);

    markRemovedSubtreeForPostDispatchTeardown(roots[1]!);
    expect(takeRemovedSubtreesForPostDispatchTeardown()).toEqual([roots[1]]);
  });

  it('collects only handles that are registered in the main-thread registry', () => {
    const root = new BackgroundElementTemplateInstance('root');
    const child = new BackgroundElementTemplateInstance('child');
    const rawText = new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, ['text']);
    child.appendChild(rawText);
    root.appendChild(child);

    expect(collectElementTemplateSubtreeHandleIds(root)).toEqual([
      root.instanceId,
      child.instanceId,
      rawText.instanceId,
    ]);
  });
});
