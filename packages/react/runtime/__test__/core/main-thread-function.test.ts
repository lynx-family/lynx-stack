import { describe, expect, it } from 'vitest';

import { isMainThreadFunction } from '../../src/core/main-thread-function.js';

describe('core/main-thread-function primitive', () => {
  it('identifies transformed main-thread functions', () => {
    expect(isMainThreadFunction({ _wkltId: 'callback' })).toBe(true);
    expect(isMainThreadFunction({ _wkltId: 1 })).toBe(false);
    expect(isMainThreadFunction({ _wvid: 1 })).toBe(false);
    expect(isMainThreadFunction(Object.assign([], { _wkltId: 'callback' }))).toBe(false);
    expect(isMainThreadFunction(null)).toBe(false);
  });
});
