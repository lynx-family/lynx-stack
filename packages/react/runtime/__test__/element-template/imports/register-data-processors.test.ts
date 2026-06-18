import { describe, expect, it, rstest as vi } from '@rstest/core';

import { root } from '@lynx-js/react/element-template';
import type { DataProcessorDefinition, DataProcessors, InitData, InitDataRaw } from '@lynx-js/react/element-template';

describe('element-template registerDataProcessors entry', () => {
  it('forwards definitions through the public root alias', () => {
    const originalRegisterDataProcessors = lynx.registerDataProcessors;
    const registerDataProcessors = vi.fn();
    lynx.registerDataProcessors = registerDataProcessors;

    try {
      const dataProcessors: DataProcessors = {
        named(raw: { value: number }) {
          return { named: raw.value };
        },
      };
      const definition: DataProcessorDefinition = {
        defaultDataProcessor(raw: InitDataRaw): InitData {
          return raw as InitData;
        },
        dataProcessors,
      };

      root.registerDataProcessors(definition);
      root.registerDataProcessors();

      expect(registerDataProcessors).toHaveBeenNthCalledWith(1, definition);
      expect(registerDataProcessors).toHaveBeenNthCalledWith(2, undefined);
    } finally {
      lynx.registerDataProcessors = originalRegisterDataProcessors;
    }
  });
});
