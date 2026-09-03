import { describe, expect, it } from '@rstest/core';

import {
  InitDataConsumer,
  InitDataProvider,
  useInitData,
  useInitDataChanged,
  withInitDataInState,
} from '@lynx-js/react/element-template';

describe('element-template initData entry', () => {
  it('exposes initData APIs from the public ET alias', () => {
    expect(InitDataProvider).toBeTruthy();
    expect(InitDataConsumer).toBeTruthy();
    expect(useInitData).toEqual(expect.any(Function));
    expect(useInitDataChanged).toEqual(expect.any(Function));
    expect(withInitDataInState).toEqual(expect.any(Function));
  });
});
