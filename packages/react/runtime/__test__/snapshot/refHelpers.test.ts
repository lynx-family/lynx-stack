// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { unref, updateRef } from '../../src/snapshot/snapshot/ref';

describe('snapshot ref helpers', () => {
  afterEach(() => {
    rs.unstubAllGlobals();
  });

  it('ignores empty entries in the worklet ref set', () => {
    const snapshot = {
      __worklet_ref_set: new Set([undefined]),
      childNodes: [],
    } as never;

    expect(() => unref(snapshot, false)).not.toThrow();
  });

  it('clears the old ref attribute without writing an empty new one', () => {
    const setAttribute = rs.fn();
    rs.stubGlobal('__SetAttribute', setAttribute);
    const element = {};
    const snapshot = {
      __id: 1,
      __values: [''],
      __elements: [element],
    } as never;

    updateRef(snapshot, 0, 'old-ref', 0);

    expect(setAttribute).toHaveBeenCalledTimes(1);
    expect(setAttribute).toHaveBeenCalledWith(element, 'old-ref', undefined);
  });
});
