import { describe, expect, it } from 'vitest';

import { defineMainThreadObjectType, useMainThreadObject } from '@lynx-js/react/element-template';

describe('element-template MainThreadObject entry', () => {
  it('exposes MainThreadObject APIs from the public ET alias', () => {
    expect(defineMainThreadObjectType).toBeTypeOf('function');
    expect(useMainThreadObject).toBeTypeOf('function');
  });
});
