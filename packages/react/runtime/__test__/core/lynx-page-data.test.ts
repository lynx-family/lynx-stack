import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyUpdatePageData } from '../../src/core/lynx-page-data.js';

describe('applyUpdatePageData', () => {
  let originalInitData: typeof lynx.__initData;

  beforeEach(() => {
    originalInitData = lynx.__initData;
  });

  afterEach(() => {
    lynx.__initData = originalInitData;
  });

  it('merges non-empty object data into the existing initData object', () => {
    const previousInitData = { msg: 'init', stable: true };
    lynx.__initData = previousInitData;

    applyUpdatePageData({ msg: 'update', next: 1 });

    expect(lynx.__initData).toBe(previousInitData);
    expect(lynx.__initData).toEqual({ msg: 'update', stable: true, next: 1 });
  });

  it('creates initData when merging into an empty main-thread state', () => {
    lynx.__initData = undefined;

    applyUpdatePageData({ msg: 'update' });

    expect(lynx.__initData).toEqual({ msg: 'update' });
  });

  it('clears existing initData before resetPageData merge', () => {
    lynx.__initData = { stale: true, msg: 'init' };

    applyUpdatePageData({ msg: 'reset' }, { resetPageData: true });

    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('supports resetPageData without update data', () => {
    lynx.__initData = { stale: true };

    applyUpdatePageData(undefined, { resetPageData: true });

    expect(lynx.__initData).toEqual({});
  });

  it('does not change initData for empty or non-object data', () => {
    const previousInitData = { msg: 'init' };
    lynx.__initData = previousInitData;

    applyUpdatePageData({});
    applyUpdatePageData(null);
    applyUpdatePageData(undefined);
    applyUpdatePageData('ignored');

    expect(lynx.__initData).toBe(previousInitData);
    expect(lynx.__initData).toEqual({ msg: 'init' });
  });
});
