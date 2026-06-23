import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { NativeUpdateDataType, updateCardData } from '../../src/core/lynx-update-data.js';
import { LynxTestEventEmitter } from '../test-utils/lynx-event-emitter.js';

describe('updateCardData', () => {
  let originalInitData: typeof lynx.__initData;
  let originalReportError: typeof lynx.reportError;
  let originalGetJSModule: typeof lynx.getJSModule;
  let emitter: LynxTestEventEmitter;

  beforeEach(() => {
    originalInitData = lynx.__initData;
    originalReportError = lynx.reportError;
    originalGetJSModule = lynx.getJSModule;
    emitter = new LynxTestEventEmitter();
    lynx.__initData = {};
    lynx.reportError = rstest.fn();
    lynx.getJSModule = rstest.fn((moduleName: string) => {
      if (moduleName === 'GlobalEventEmitter') {
        return emitter;
      }
      return originalGetJSModule(moduleName);
    }) as typeof lynx.getJSModule;
  });

  afterEach(() => {
    lynx.__initData = originalInitData;
    lynx.reportError = originalReportError;
    lynx.getJSModule = originalGetJSModule;
  });

  it('COW merges update data and emits the current patch data', () => {
    const previousInitData = { msg: 'init', stable: true };
    const listener = rstest.fn();
    lynx.__initData = previousInitData;
    emitter.addListener('onDataChanged', listener);

    updateCardData({
      msg: 'update',
      next: 1,
    });

    expect(lynx.__initData).toEqual({ msg: 'update', stable: true, next: 1 });
    expect(lynx.__initData).not.toBe(previousInitData);
    expect(listener).toHaveBeenCalledWith({ msg: 'update', next: 1 });
    expect(lynx.reportError).not.toHaveBeenCalled();
  });

  it('clears existing initData before RESET updates', () => {
    const listener = rstest.fn();
    lynx.__initData = { stale: true, msg: 'init' };
    emitter.addListener('onDataChanged', listener);

    updateCardData(
      { msg: 'reset' },
      { type: NativeUpdateDataType.RESET },
    );

    expect(lynx.__initData).toEqual({ msg: 'reset' });
    expect(listener).toHaveBeenCalledWith({ msg: 'reset' });
  });

  it('keeps Snapshot-compatible loose RESET matching', () => {
    const listener = rstest.fn();
    lynx.__initData = { stale: true, msg: 'init' };
    emitter.addListener('onDataChanged', listener);

    updateCardData(
      { msg: 'reset' },
      { type: '1' as unknown as NativeUpdateDataType },
    );

    expect(lynx.__initData).toEqual({ msg: 'reset' });
    expect(listener).toHaveBeenCalledWith({ msg: 'reset' });
  });

  it('reports and strips __lynx_timing_flag from the merged data and emitted patch', () => {
    const listener = rstest.fn();
    lynx.__initData = { msg: 'init' };
    emitter.addListener('onDataChanged', listener);

    updateCardData({
      msg: 'update',
      __lynx_timing_flag: '__lynx_timing_actual_fmp',
    });

    expect(lynx.__initData).toEqual({ msg: 'update' });
    expect(listener).toHaveBeenCalledWith({ msg: 'update' });
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).toHaveBeenCalledWith(
      new Error(
        'Received unsupported updateData with `__lynx_timing_flag` (value "__lynx_timing_actual_fmp"), the timing flag is ignored',
      ),
    );
  });
});
