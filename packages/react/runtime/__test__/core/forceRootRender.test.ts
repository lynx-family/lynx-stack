// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options as preactOptions } from 'preact';
import type { VNode } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWithForceRootRender } from '../../src/core/forceRootRender.js';
import { COMPONENT, DIFF2, FORCE, ORIGINAL } from '../../src/shared/render-constants.js';

const mutablePreactOptions = preactOptions as typeof preactOptions & Record<string, any>;

describe('core/forceRootRender', () => {
  afterEach(() => {
    delete mutablePreactOptions[DIFF2];
    vi.restoreAllMocks();
  });

  it('bumps root vnode identity and marks existing components as forced', () => {
    const oldDiff = vi.fn();
    mutablePreactOptions[DIFF2] = oldDiff;
    const component = {};
    const rootVNode = { [ORIGINAL]: 1 } as VNode;
    const setRootVNode = vi.fn();

    runWithForceRootRender({
      getRootVNode: () => rootVNode,
      setRootVNode,
      render: () => {
        mutablePreactOptions[DIFF2]({} as VNode, { [COMPONENT]: component } as VNode);
      },
    });

    expect(setRootVNode).toHaveBeenCalledTimes(1);
    expect(setRootVNode.mock.calls[0]![0]).not.toBe(rootVNode);
    expect(setRootVNode.mock.calls[0]![0][ORIGINAL]).toBe(2);
    expect(oldDiff).toHaveBeenCalledTimes(1);
    expect(component[FORCE]).toBe(true);
    expect(mutablePreactOptions[DIFF2]).toBe(oldDiff);
  });

  it('handles mount-phase vnodes and restores diff hook after render throws', () => {
    const setRootVNode = vi.fn();
    const error = new Error('render failed');

    expect(() =>
      runWithForceRootRender({
        getRootVNode: () => undefined,
        setRootVNode,
        render: () => {
          mutablePreactOptions[DIFF2]({} as VNode, {} as VNode);
          throw error;
        },
      })
    ).toThrow(error);

    expect(setRootVNode).not.toHaveBeenCalled();
    expect(mutablePreactOptions[DIFF2]).toBeUndefined();
  });
});
