// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkletExecIdMap } from '../../src/worklet/call/execMap';

beforeEach(() => {
  SystemInfo.lynxSdkVersion = '999.999';
});

describe('WorkletExecIdMap', () => {
  it('should add, get and remove', () => {
    const map = new WorkletExecIdMap();
    const fn = {
      _jsFnId: 233,
    };
    const worklet = {
      xxx: {
        yyy: 1,
        zzz: fn,
      },
    };
    const execId = map.add(worklet);
    let fnFound = map.findJsFnHandle(execId, 233);
    expect(fnFound).toBe(fn);

    fnFound = map.findJsFnHandle(execId, 234);
    expect(fnFound).toBe(undefined);

    map.remove(execId);
    fnFound = map.findJsFnHandle(execId, 233);
    expect(fnFound).toBe(undefined);
  });
});
