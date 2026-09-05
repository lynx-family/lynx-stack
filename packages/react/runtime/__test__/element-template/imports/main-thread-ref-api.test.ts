import { describe, expect, it } from '@rstest/core';

import { MainThreadRef, useMainThreadRef } from '@lynx-js/react/element-template';

describe('element-template MainThreadRef entry', () => {
  it('exposes MainThreadRef APIs from the public ET alias', () => {
    expect(MainThreadRef).toBeTypeOf('function');
    expect(useMainThreadRef).toBeTypeOf('function');
  });
});
