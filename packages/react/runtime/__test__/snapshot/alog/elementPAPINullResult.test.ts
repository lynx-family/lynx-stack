// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { initElementPAPICallAlog } from '../../../src/snapshot/alog/elementPAPICall';

describe('ElementPAPICall Alog result formatting', () => {
  const originalAlog = console.alog;

  afterEach(() => {
    console.alog = originalAlog;
  });

  it('logs a null PAPI result without formatting it', () => {
    const alog = rs.fn();
    console.alog = alog;
    const target: Record<string, unknown> = {
      __GetTag: () => null,
      __GetElementUniqueID: () => 1,
    };

    initElementPAPICallAlog(target);
    (target['__GetTag'] as () => unknown)();

    expect(alog).toHaveBeenCalledTimes(1);
    expect(alog.mock.calls[0]![0]).toContain('__GetTag()');
    expect(alog.mock.calls[0]![0]).not.toContain('undefined');
  });
});
