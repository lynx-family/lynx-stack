import { describe, expect, it } from 'vitest';

import ElementTemplateRuntime, { Suspense, lazy } from '@lynx-js/react/element-template';
import * as ElementTemplateInternal from '@lynx-js/react/element-template/internal';
import { loadLazyBundle } from '@lynx-js/react/element-template/internal';

describe('element-template Suspense and lazy imports', () => {
  it('exposes Suspense and lazy from the ET root entry', () => {
    expect(Suspense).toEqual(expect.any(Function));
    expect(lazy).toEqual(expect.any(Function));
    expect(ElementTemplateRuntime.Suspense).toBe(Suspense);
    expect(ElementTemplateRuntime.lazy).toBe(lazy);
  });

  it('exposes shared loadLazyBundle without enabling component-is', () => {
    expect(loadLazyBundle).toEqual(expect.any(Function));
    expect(ElementTemplateInternal.loadLazyBundle).toBe(loadLazyBundle);
    expect('__ComponentIsPolyfill' in ElementTemplateInternal).toBe(false);
  });
});
