import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { MainThreadRef, clearMainThreadRefLastIdForTesting, isMainThreadRef } from '../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../src/core/mts-capability.js';

describe('core/main-thread-ref primitive', () => {
  beforeEach(() => {
    rs.stubGlobal('__DEV__', true);
    rs.stubGlobal('__JS__', true);
    rs.stubGlobal('__LEPUS__', false);
    rs.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
    rs.stubGlobal('lynx', {
      getNativeApp: rs.fn(() => ({
        createJSObjectDestructionObserver: rs.fn(),
      })),
      getCoreContext: rs.fn(() => ({
        dispatchEvent: rs.fn(),
      })),
    });
    clearMtsConfigCacheForTesting();
    clearMainThreadRefLastIdForTesting();
    takeMainThreadRefInitValuePatch();
  });

  afterEach(() => {
    takeMainThreadRefInitValuePatch();
    rs.unstubAllGlobals();
  });

  it('allocates background ids and records init value patches', () => {
    const first = new MainThreadRef('first');
    const second = new MainThreadRef('second');

    expect(JSON.stringify(first)).toBe('{"_wvid":1}');
    expect(JSON.stringify(second)).toBe('{"_wvid":2}');
    expect(takeMainThreadRefInitValuePatch()).toEqual([
      [1, 'first'],
      [2, 'second'],
    ]);
    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('allocates first-screen main-thread ids without init value patches', () => {
    rs.stubGlobal('__JS__', false);
    rs.stubGlobal('__LEPUS__', true);

    const ref = new MainThreadRef('first-screen');

    expect(JSON.stringify(ref)).toBe('{"_wvid":-1}');
    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('does not record init value patches below the MTS sdk gate', () => {
    rs.stubGlobal('SystemInfo', { lynxSdkVersion: '2.13' });
    clearMtsConfigCacheForTesting();

    new MainThreadRef('unsupported');

    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('dispatches release event from the destruction observer', () => {
    let release: (() => void) | undefined;
    const dispatchEvent = rs.fn();
    const createJSObjectDestructionObserver = rs.fn((callback: () => void) => {
      release = callback;
      return {};
    });
    rs.stubGlobal('lynx', {
      getNativeApp: rs.fn(() => ({ createJSObjectDestructionObserver })),
      getCoreContext: rs.fn(() => ({ dispatchEvent })),
    });

    new MainThreadRef('value');
    release!();

    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'Lynx.Worklet.releaseWorkletRef',
      data: {
        id: 1,
      },
    });
  });

  it('keeps the DEV access errors from the public MainThreadRef contract', () => {
    const ref = new MainThreadRef('value');

    expect(() => ref.current).toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.',
    );
    expect(() => ref.current = 'next').toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.',
    );
  });

  it('identifies object refs', () => {
    expect(isMainThreadRef({ _wvid: 1 })).toBe(true);
    expect(isMainThreadRef({ _wvid: '1' })).toBe(false);
    expect(isMainThreadRef(null)).toBe(false);
  });
});
