import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MainThreadRef,
  clearMainThreadRefLastIdForTesting,
  isMainThreadRef,
  isMainThreadRefCallback,
} from '../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../src/core/mts-capability.js';

describe('core/main-thread-ref primitive', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal('__JS__', true);
    vi.stubGlobal('__LEPUS__', false);
    vi.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
    vi.stubGlobal('lynx', {
      getNativeApp: vi.fn(() => ({
        createJSObjectDestructionObserver: vi.fn(),
      })),
      getCoreContext: vi.fn(() => ({
        dispatchEvent: vi.fn(),
      })),
    });
    clearMtsConfigCacheForTesting();
    clearMainThreadRefLastIdForTesting();
    takeMainThreadRefInitValuePatch();
  });

  afterEach(() => {
    takeMainThreadRefInitValuePatch();
    vi.unstubAllGlobals();
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
    vi.stubGlobal('__JS__', false);
    vi.stubGlobal('__LEPUS__', true);

    const ref = new MainThreadRef('first-screen');

    expect(JSON.stringify(ref)).toBe('{"_wvid":-1}');
    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('does not record init value patches below the MTS sdk gate', () => {
    vi.stubGlobal('SystemInfo', { lynxSdkVersion: '2.13' });
    clearMtsConfigCacheForTesting();

    new MainThreadRef('unsupported');

    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('dispatches release event from the destruction observer', () => {
    let release: (() => void) | undefined;
    const dispatchEvent = vi.fn();
    const createJSObjectDestructionObserver = vi.fn((callback: () => void) => {
      release = callback;
      return {};
    });
    vi.stubGlobal('lynx', {
      getNativeApp: vi.fn(() => ({ createJSObjectDestructionObserver })),
      getCoreContext: vi.fn(() => ({ dispatchEvent })),
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

  it('identifies object refs and main-thread callback worklets', () => {
    expect(isMainThreadRef({ _wvid: 1 })).toBe(true);
    expect(isMainThreadRef({ _wvid: '1' })).toBe(false);
    expect(isMainThreadRef(null)).toBe(false);
    expect(isMainThreadRefCallback({ _wkltId: 'callback' })).toBe(true);
    expect(isMainThreadRefCallback({ _wkltId: 1 })).toBe(false);
    expect(isMainThreadRefCallback({ _wvid: 1 })).toBe(false);
  });
});
