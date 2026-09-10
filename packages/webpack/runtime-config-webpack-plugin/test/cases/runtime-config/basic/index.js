// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

it('should inject runtime config', () => {
  expect(lynx.__runtime_configs__).toEqual({
    bundleConfig: {
      enabled: true,
    },
  });
  expect(Object.isFrozen(lynx.__runtime_configs__)).toBe(true);
});
