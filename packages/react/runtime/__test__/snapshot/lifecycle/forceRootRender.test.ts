// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options as preactOptions } from 'preact';
import type { VNode } from 'preact';
import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { runWithForceRootRender } from '../../../src/core/forceRootRender.js';
import { DIFF2, ORIGINAL } from '../../../src/shared/render-constants.js';

const mutablePreactOptions = preactOptions as typeof preactOptions & Record<string, any>;
const initialDiff2 = mutablePreactOptions[DIFF2];

describe('core/forceRootRender', () => {
  afterEach(() => {
    if (typeof initialDiff2 === 'undefined') {
      delete mutablePreactOptions[DIFF2];
    } else {
      mutablePreactOptions[DIFF2] = initialDiff2;
    }
    rs.restoreAllMocks();
  });

  it('does not replace the root vnode when it carries no original identity', () => {
    const rootVNode = {} as VNode;
    const setRootVNode = rs.fn();

    runWithForceRootRender({
      getRootVNode: () => rootVNode,
      setRootVNode,
      render: () => {},
    });

    expect(setRootVNode).not.toHaveBeenCalled();
  });
});
