import { describe, expect, it } from 'vitest';

import {
  InitDataConsumer,
  InitDataProvider,
  useInitData,
  useInitDataChanged,
  withInitDataInState,
} from '@lynx-js/react/element-template';
import { withInitDataInState as internalWithInitDataInState } from '@lynx-js/react/element-template/internal';

describe('element-template InitData entry', () => {
  it('exposes the public and internal InitData read API surface', () => {
    expect(InitDataProvider).toBeTypeOf('function');
    expect(InitDataConsumer).toBeTypeOf('function');
    expect(useInitData).toBeTypeOf('function');
    expect(useInitDataChanged).toBeTypeOf('function');
    expect(withInitDataInState).toBeTypeOf('function');
    expect(internalWithInitDataInState).toBe(withInitDataInState);
  });
});
