import { describe, expect, it } from '@rstest/core';

import { getReloadVersion, increaseReloadVersion } from '../../src/core/reload-version.js';

describe('reload version', () => {
  it('increments monotonically and exposes the current version', () => {
    const initial = getReloadVersion();

    expect(increaseReloadVersion()).toBe(initial + 1);
    expect(getReloadVersion()).toBe(initial + 1);
    expect(increaseReloadVersion()).toBe(initial + 2);
    expect(getReloadVersion()).toBe(initial + 2);
  });
});
