import { describe, expect, it } from 'vitest';

import {
  GlobalPropsConsumer,
  GlobalPropsProvider,
  useGlobalProps,
  useGlobalPropsChanged,
  useLynxGlobalEventListener,
} from '@lynx-js/react/element-template';
import type { GlobalProps } from '@lynx-js/react/element-template';

describe('element-template GlobalProps entry', () => {
  it('exposes GlobalProps APIs from the public ET alias', () => {
    const globalProps: GlobalProps = {};

    expect(globalProps).toEqual({});
    expect(GlobalPropsProvider).toBeTruthy();
    expect(GlobalPropsConsumer).toBeTruthy();
    expect(useGlobalProps).toEqual(expect.any(Function));
    expect(useGlobalPropsChanged).toEqual(expect.any(Function));
    expect(useLynxGlobalEventListener).toEqual(expect.any(Function));
  });
});
