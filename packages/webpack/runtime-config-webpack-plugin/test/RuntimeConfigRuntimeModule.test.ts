// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import vm from 'node:vm';

import { rspack } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { createRuntimeConfigRuntimeModule } from '../src/RuntimeConfigRuntimeModule.js';

const RuntimeConfigRuntimeModule = createRuntimeConfigRuntimeModule(rspack);

it('resets stale config when the same entry is evaluated again', () => {
  const lynx = { __runtime_configs__: {} as Record<string, unknown> };
  const context = vm.createContext({ lynx });
  const code = new RuntimeConfigRuntimeModule({
    bundleConfig: { enabled: true },
  }).generate()!;

  vm.runInContext(code, context);
  const firstConfig = lynx.__runtime_configs__;
  firstConfig['staleConfig'] = true;
  firstConfig['bundleConfig'] = { enabled: false };
  Object.freeze(firstConfig);

  expect(() => {
    vm.runInContext(code, context);
  }).not.toThrow();
  expect(lynx.__runtime_configs__).not.toBe(firstConfig);
  expect(lynx.__runtime_configs__).toEqual({
    bundleConfig: { enabled: true },
  });
  expect(Object.isFrozen(lynx.__runtime_configs__)).toBe(false);
  expect(Object.isFrozen(lynx.__runtime_configs__['bundleConfig'])).toBe(
    false,
  );
});
