// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/element-template/background/hydrate.js', () => ({
  hydrateRootChildrenIntoContext: vi.fn(),
}));

import { hydrateRootChildrenIntoContext } from '../../../../src/element-template/background/hydrate.js';
import type { BackgroundPageRootInstance } from '../../../../src/element-template/background/instance.js';
import { hydratePageRootIntoContext } from '../../../../src/element-template/background/page-root-hydrate.js';
import type { SerializedElementTemplate, SerializedPageRoot } from '../../../../src/element-template/protocol/types.js';

describe('hydratePageRootIntoContext', () => {
  const reconcileAuthoredPageAttributesOnHydration = vi.fn();
  const root = {
    reconcileAuthoredPageAttributesOnHydration,
  } as unknown as BackgroundPageRootInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hydrateRootChildrenIntoContext).mockReturnValue(true);
  });

  it('hydrates slot-0 roots before reconciling page attributes', () => {
    const child = {
      templateKey: '_et_root',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    } satisfies SerializedElementTemplate;
    const page = {
      tag: 'page',
      attributes: { id: 'main-thread' },
      elementSlots: [[child]],
      uid: 0,
    } satisfies SerializedPageRoot;

    expect(hydratePageRootIntoContext(page, root)).toBe(true);

    expect(hydrateRootChildrenIntoContext).toHaveBeenCalledWith([child], root);
    expect(reconcileAuthoredPageAttributesOnHydration).toHaveBeenCalledWith({
      id: 'main-thread',
    });
    expect(vi.mocked(hydrateRootChildrenIntoContext).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(reconcileAuthoredPageAttributesOnHydration).mock.invocationCallOrder[0]!,
    );
  });

  it('does not reconcile page attributes when child hydration fails', () => {
    vi.mocked(hydrateRootChildrenIntoContext).mockReturnValue(false);
    const page = {
      tag: 'page',
      attributes: { id: 'main-thread' },
      elementSlots: [[]],
      uid: 0,
    } satisfies SerializedPageRoot;

    expect(hydratePageRootIntoContext(page, root)).toBe(false);
    expect(reconcileAuthoredPageAttributesOnHydration).not.toHaveBeenCalled();
  });

  it('normalizes omitted page slots and attributes at the boundary', () => {
    const page = {
      tag: 'page',
      uid: '0',
    } satisfies SerializedPageRoot;

    expect(hydratePageRootIntoContext(page, root)).toBe(true);
    expect(hydrateRootChildrenIntoContext).toHaveBeenCalledWith([], root);
    expect(reconcileAuthoredPageAttributesOnHydration).toHaveBeenCalledWith(null);
  });
});
