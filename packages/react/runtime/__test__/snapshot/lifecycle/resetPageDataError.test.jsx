// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESET_WITH_INIT_DATA_IN_STATE_ERROR } from '../../../src/core/initData';
import { applyUpdatePageData } from '../../../src/core/lynx-page-data';
import { NativeUpdateDataType, updateCardData } from '../../../src/core/lynx-update-data';
import { withInitDataInState } from '../../../src/lynx-api';
import { globalEnvManager } from '../utils/envManager';

// Constructing a wrapped component flips the (sticky, dev-only) usage flag. Run it on the
// main thread so it does not register a background `onDataChanged` listener.
function markWithInitDataInStateUsed() {
  globalEnvManager.switchToMainThread();
  new (withInitDataInState(
    class extends Component {
      render() {
        return null;
      }
    },
  ))({});
}

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToMainThread();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('data reset + withInitDataInState dev error', () => {
  it('does not report on a main-thread resetPageData when withInitDataInState is unused', () => {
    const spy = vi.spyOn(lynx, 'reportError');

    applyUpdatePageData({ msg: 'reset' }, { resetPageData: true });

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not report on a background updateCardData reset when withInitDataInState is unused', () => {
    globalEnvManager.switchToBackground();
    const spy = vi.spyOn(lynx, 'reportError');

    updateCardData({ msg: 'reset' }, { type: NativeUpdateDataType.RESET });

    expect(spy).not.toHaveBeenCalled();
  });

  it('reports once on a main-thread resetPageData combined with withInitDataInState', () => {
    markWithInitDataInStateUsed();
    const spy = vi.spyOn(lynx, 'reportError');

    applyUpdatePageData({ msg: 'reset' }, { resetPageData: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0]?.message ?? '')).toBe(RESET_WITH_INIT_DATA_IN_STATE_ERROR);

    // report-once: a later reset does not report again
    applyUpdatePageData({ msg: 'reset again' }, { resetPageData: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports once on a background updateCardData reset combined with withInitDataInState', () => {
    markWithInitDataInStateUsed();
    globalEnvManager.switchToBackground();
    const spy = vi.spyOn(lynx, 'reportError');

    updateCardData({ msg: 'reset' }, { type: NativeUpdateDataType.RESET });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0]?.message ?? '')).toBe(RESET_WITH_INIT_DATA_IN_STATE_ERROR);

    // report-once: a later reset does not report again
    updateCardData({ msg: 'reset again' }, { type: NativeUpdateDataType.RESET });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
