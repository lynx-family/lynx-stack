import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';
// `rstest.resetModules()` must be a literal call (module-mock APIs are not
// aliasable).
import { rstest } from '@rstest/core';

type PerformanceLike = {
  isProfileRecording?: () => boolean;
  profileStart?: (traceName: string, option?: unknown) => void;
  profileEnd?: () => void;
  profileFlowId?: () => number;
};

type LynxLike = {
  performance?: PerformanceLike;
};

describe('shared/profile module', () => {
  let originalLynx: LynxLike;
  let originalProfileFlag: unknown;

  beforeEach(() => {
    rstest.resetModules();
    originalLynx = globalThis.lynx as LynxLike;
    // eslint-disable-next-line no-undef
    originalProfileFlag = typeof __PROFILE__ === 'undefined' ? undefined : __PROFILE__;
  });

  afterEach(() => {
    globalThis.lynx = originalLynx as typeof globalThis.lynx;
    // eslint-disable-next-line no-undef
    globalThis.__PROFILE__ = originalProfileFlag as boolean | undefined;
  });

  it('should indicate profiling is enabled when recording is active', async () => {
    const perf: PerformanceLike = {
      isProfileRecording: rstest.fn(() => true),
    };
    globalThis.lynx = {
      ...globalThis.lynx,
      performance: perf,
    };

    const profile = await import('../../src/shared/profile');

    expect(profile.isProfiling).toBe(true);
  });

  it('should fallback to no-op APIs when profile functions are unavailable', async () => {
    const perf: PerformanceLike = {
      isProfileRecording: rstest.fn(() => false),
    };
    // eslint-disable-next-line no-undef
    globalThis.__PROFILE__ = false;
    globalThis.lynx = {
      ...globalThis.lynx,
      performance: perf,
    };

    const profile = await import('../../src/shared/profile');

    expect(profile.isProfiling).toBe(false);
    expect(() => profile.profileStart('trace')).not.toThrow();
    expect(() => profile.profileEnd()).not.toThrow();
    expect(profile.profileFlowId()).toBe(0);
  });

  it('should bind and call native profile APIs when available', async () => {
    const perf = {
      isProfileRecording: rstest.fn(() => true),
      profileStart: rstest.fn(),
      profileEnd: rstest.fn(),
      profileFlowId: rstest.fn(() => 123),
    };
    // eslint-disable-next-line no-undef
    globalThis.__PROFILE__ = true;
    globalThis.lynx = {
      ...globalThis.lynx,
      performance: perf,
    };

    const profile = await import('../../src/shared/profile');

    profile.profileStart('trace-name', { args: { foo: 'bar' } });
    profile.profileEnd();
    expect(profile.profileFlowId()).toBe(123);

    expect(perf.profileStart).toBeCalledWith('trace-name', { args: { foo: 'bar' } });
    expect(perf.profileEnd).toBeCalledTimes(1);
    expect(perf.profileFlowId).toBeCalledTimes(1);
  });
});
