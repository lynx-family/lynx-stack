import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyInitDataUpdateFromNative, NativeUpdateDataType } from '../../src/core/lynx-update-data.js';

describe('applyInitDataUpdateFromNative', () => {
  let originalInitData: typeof lynx.__initData;
  let originalReportError: typeof lynx.reportError;

  beforeEach(() => {
    originalInitData = lynx.__initData;
    originalReportError = lynx.reportError;
    lynx.__initData = {};
    lynx.reportError = vi.fn();
  });

  afterEach(() => {
    lynx.__initData = originalInitData;
    lynx.reportError = originalReportError;
  });

  it('COW merges update data and returns the current patch data', () => {
    const previousInitData = { msg: 'init', stable: true };
    lynx.__initData = previousInitData;

    const restNewData = applyInitDataUpdateFromNative({
      msg: 'update',
      next: 1,
    });

    expect(restNewData).toEqual({ msg: 'update', next: 1 });
    expect(lynx.__initData).toEqual({ msg: 'update', stable: true, next: 1 });
    expect(lynx.__initData).not.toBe(previousInitData);
    expect(lynx.reportError).not.toHaveBeenCalled();
  });

  it('clears existing initData before RESET updates', () => {
    lynx.__initData = { stale: true, msg: 'init' };

    const restNewData = applyInitDataUpdateFromNative(
      { msg: 'reset' },
      { type: NativeUpdateDataType.RESET },
    );

    expect(restNewData).toEqual({ msg: 'reset' });
    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('keeps Snapshot-compatible loose RESET matching', () => {
    lynx.__initData = { stale: true, msg: 'init' };

    const restNewData = applyInitDataUpdateFromNative(
      { msg: 'reset' },
      { type: '1' as unknown as NativeUpdateDataType },
    );

    expect(restNewData).toEqual({ msg: 'reset' });
    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('reports and strips __lynx_timing_flag from the merged data and return value', () => {
    lynx.__initData = { msg: 'init' };

    const restNewData = applyInitDataUpdateFromNative({
      msg: 'update',
      __lynx_timing_flag: '__lynx_timing_actual_fmp',
    });

    expect(restNewData).toEqual({ msg: 'update' });
    expect(lynx.__initData).toEqual({ msg: 'update' });
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).toHaveBeenCalledWith(
      new Error(
        'Received unsupported updateData with `__lynx_timing_flag` (value "__lynx_timing_actual_fmp"), the timing flag is ignored',
      ),
    );
  });
});
